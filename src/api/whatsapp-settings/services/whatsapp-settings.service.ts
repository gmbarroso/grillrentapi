import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OrganizationWhatsappIntegration,
  WhatsappIntegrationStatus,
} from '../entities/organization-whatsapp-integration.entity';
import { OrganizationWhatsappGroupBinding } from '../entities/organization-whatsapp-group-binding.entity';
import {
  TestWhatsappConnectionDto,
  UpdateWhatsappSettingsDto,
  UpsertWhatsappGroupBindingDto,
  WhatsappGroupBindingDto,
  WhatsappGroupOptionDto,
  WhatsappSettingsViewDto,
} from '../dto/whatsapp-settings.dto';

interface EvolutionGroupPayload {
  id?: string | { _serialized?: string; user?: string; server?: string };
  jid?: string | { _serialized?: string; user?: string; server?: string };
  subject?: string;
  name?: string;
  notify?: string;
}

@Injectable()
export class WhatsappSettingsService {
  private readonly logger = new Logger(WhatsappSettingsService.name);

  constructor(
    @InjectRepository(OrganizationWhatsappIntegration)
    private readonly integrationRepository: Repository<OrganizationWhatsappIntegration>,
    @InjectRepository(OrganizationWhatsappGroupBinding)
    private readonly bindingRepository: Repository<OrganizationWhatsappGroupBinding>,
    private readonly configService: ConfigService,
  ) {}

  async getSettings(organizationId: string): Promise<WhatsappSettingsViewDto> {
    const integration = await this.integrationRepository.findOne({ where: { organizationId } });
    const noticeBinding = await this.bindingRepository.findOne({ where: { organizationId, feature: 'notices' } });

    if (!integration) {
      return {
        provider: 'evolution',
        status: 'disconnected',
        baseUrl: '',
        instanceName: '',
        hasApiKey: false,
        apiKeyMasked: null,
        whatsappNumber: null,
        autoSendNotices: false,
        noticeGroupJid: null,
        noticeGroupName: null,
      };
    }

    return {
      provider: integration.provider,
      status: integration.status,
      baseUrl: integration.baseUrl,
      instanceName: integration.instanceName,
      hasApiKey: Boolean(integration.apiKey),
      apiKeyMasked: this.maskApiKey(integration.apiKey),
      whatsappNumber: integration.whatsappNumber ?? null,
      autoSendNotices: integration.autoSendNotices,
      noticeGroupJid: noticeBinding?.groupJid ?? null,
      noticeGroupName: noticeBinding?.groupName ?? null,
    };
  }

  async bootstrapFromLegacyEnv(organizationId: string): Promise<WhatsappSettingsViewDto> {
    const existing = await this.integrationRepository.findOne({ where: { organizationId } });
    if (existing) {
      return this.getSettings(organizationId);
    }

    const baseUrl = this.configService.get<string>('WHATSAPP_EVOLUTION_BASE_URL')?.trim();
    const instanceName = this.configService.get<string>('WHATSAPP_EVOLUTION_INSTANCE')?.trim();
    const apiKey = this.configService.get<string>('WHATSAPP_EVOLUTION_API_KEY')?.trim();

    if (!baseUrl || !instanceName || !apiKey) {
      throw new NotFoundException('Legacy WhatsApp provider configuration is not available');
    }

    const integration = this.integrationRepository.create({
      organizationId,
      provider: 'evolution',
      baseUrl,
      instanceName,
      apiKey,
      autoSendNotices: false,
      status: 'connected',
    });

    const savedIntegration = await this.integrationRepository.save(integration);

    const legacyNoticeGroupJid = this.resolveLegacyGroupJid(organizationId);
    if (legacyNoticeGroupJid) {
      const binding = this.bindingRepository.create({
        organizationId,
        integrationId: savedIntegration.id,
        feature: 'notices',
        groupJid: legacyNoticeGroupJid,
        groupName: null,
      });
      await this.bindingRepository.save(binding);
    }

    return this.getSettings(organizationId);
  }

  async isAutoSendNoticesEnabled(organizationId: string): Promise<boolean> {
    const integration = await this.integrationRepository.findOne({ where: { organizationId } });
    return Boolean(integration?.autoSendNotices);
  }

  async updateSettings(organizationId: string, data: UpdateWhatsappSettingsDto): Promise<WhatsappSettingsViewDto> {
    const existing = await this.integrationRepository.findOne({ where: { organizationId } });
    const cleanApiKey = data.apiKey?.trim();

    const integration = this.integrationRepository.create({
      id: existing?.id,
      organizationId,
      provider: 'evolution',
      baseUrl: data.baseUrl.trim(),
      instanceName: data.instanceName.trim(),
      apiKey: cleanApiKey ? cleanApiKey : existing?.apiKey ?? '',
      whatsappNumber: data.whatsappNumber?.trim() || null,
      autoSendNotices: Boolean(data.autoSendNotices),
      status: this.resolveStatus(cleanApiKey || existing?.apiKey),
    });

    await this.integrationRepository.save(integration);
    return this.getSettings(organizationId);
  }

  async testConnection(organizationId: string, data?: TestWhatsappConnectionDto): Promise<{ ok: boolean; statusCode: number | null }> {
    const resolved = await this.resolveProviderCredentials(organizationId, data);
    if (!resolved) {
      return { ok: false, statusCode: null };
    }

    const endpoint = `${resolved.baseUrl.replace(/\/+$/, '')}/instance/fetchInstances`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: resolved.apiKey,
      },
    });

    const status: WhatsappIntegrationStatus = response.ok ? 'connected' : 'disconnected';

    await this.integrationRepository.update(
      { organizationId },
      {
        status,
      },
    );

    return {
      ok: response.ok,
      statusCode: response.status,
    };
  }

  async getGroupBindings(organizationId: string): Promise<WhatsappGroupBindingDto[]> {
    const rows = await this.bindingRepository.find({ where: { organizationId }, order: { feature: 'ASC' } });

    return rows.map((row) => ({
      feature: row.feature,
      groupJid: row.groupJid,
      groupName: row.groupName ?? null,
    }));
  }

  async upsertGroupBinding(
    organizationId: string,
    feature: string,
    data: UpsertWhatsappGroupBindingDto,
  ): Promise<WhatsappGroupBindingDto> {
    const integration = await this.integrationRepository.findOne({ where: { organizationId } });
    if (!integration) {
      throw new NotFoundException('WhatsApp integration is not configured');
    }

    const normalizedFeature = feature.trim().toLowerCase();
    const existing = await this.bindingRepository.findOne({ where: { organizationId, feature: normalizedFeature } });

    const binding = this.bindingRepository.create({
      id: existing?.id,
      organizationId,
      integrationId: integration.id,
      feature: normalizedFeature,
      groupJid: data.groupJid.trim(),
      groupName: data.groupName?.trim() || null,
    });

    const saved = await this.bindingRepository.save(binding);

    return {
      feature: saved.feature,
      groupJid: saved.groupJid,
      groupName: saved.groupName ?? null,
    };
  }

  async fetchGroups(organizationId: string): Promise<WhatsappGroupOptionDto[]> {
    const credentials = await this.resolveProviderCredentials(organizationId);
    if (!credentials) {
      throw new NotFoundException('WhatsApp integration is not configured');
    }

    const endpoint = `${credentials.baseUrl.replace(/\/+$/, '')}/group/fetchAllGroups/${encodeURIComponent(credentials.instanceName)}`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: credentials.apiKey,
      },
    });

    if (!response.ok) {
      const bodyText = await this.readBodySafe(response);
      this.logger.warn(
        JSON.stringify({
          event: 'whatsapp_group_fetch_failed',
          organizationId,
          statusCode: response.status,
          body: bodyText,
        }),
      );
      throw new BadGatewayException(`Unable to fetch WhatsApp groups from provider (status ${response.status})`);
    }

    const payload = (await this.readJsonSafe<unknown>(response)) ?? [];
    const groups = this.normalizeGroups(payload)
      .filter((group) => group.groupJid)
      .map((group) => ({
        groupJid: group.groupJid,
        groupName: group.groupName,
      }));

    return groups;
  }

  async getDeliveryConfigForFeature(
    organizationId: string,
    feature: string,
  ): Promise<{ baseUrl: string; instanceName: string; apiKey: string; groupJid: string; autoSendNotices: boolean } | null> {
    const integration = await this.integrationRepository.findOne({ where: { organizationId } });
    if (!integration?.baseUrl || !integration.instanceName || !integration.apiKey) {
      return null;
    }

    const binding = await this.bindingRepository.findOne({
      where: { organizationId, feature: feature.trim().toLowerCase() },
    });

    if (!binding?.groupJid) {
      return null;
    }

    return {
      baseUrl: integration.baseUrl.trim(),
      instanceName: integration.instanceName.trim(),
      apiKey: integration.apiKey.trim(),
      groupJid: binding.groupJid.trim(),
      autoSendNotices: integration.autoSendNotices,
    };
  }

  private async resolveProviderCredentials(
    organizationId: string,
    input?: TestWhatsappConnectionDto,
  ): Promise<{ baseUrl: string; instanceName: string; apiKey: string } | null> {
    const integration = await this.integrationRepository.findOne({ where: { organizationId } });

    const baseUrl = input?.baseUrl?.trim() || integration?.baseUrl?.trim();
    const instanceName = input?.instanceName?.trim() || integration?.instanceName?.trim();
    const apiKey = input?.apiKey?.trim() || integration?.apiKey?.trim();

    if (!baseUrl || !instanceName || !apiKey) {
      return null;
    }

    return { baseUrl, instanceName, apiKey };
  }

  private resolveStatus(apiKey?: string): WhatsappIntegrationStatus {
    return apiKey ? 'connected' : 'disconnected';
  }

  private maskApiKey(value: string): string {
    if (!value) {
      return '';
    }
    if (value.length <= 8) {
      return '****';
    }

    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
  }

  private normalizeGroups(payload: unknown): WhatsappGroupOptionDto[] {
    if (Array.isArray(payload)) {
      return payload
        .map((row) => this.normalizeGroupRow(row as EvolutionGroupPayload))
        .filter((item): item is WhatsappGroupOptionDto => Boolean(item));
    }

    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const nestedCandidates = [record.groups, record.data, record.result, record.response];
      const nested = nestedCandidates.find((candidate) => Array.isArray(candidate));
      if (Array.isArray(nested)) {
        return (nested as unknown[])
          .map((row) => this.normalizeGroupRow(row as EvolutionGroupPayload))
          .filter((item): item is WhatsappGroupOptionDto => Boolean(item));
      }
    }

    return [];
  }

  private normalizeGroupRow(group: EvolutionGroupPayload): WhatsappGroupOptionDto | null {
    const groupJid = this.normalizeJidField(group.id) || this.normalizeJidField(group.jid);
    if (!groupJid) {
      return null;
    }

    const groupName = (group.subject || group.name || group.notify || groupJid).trim();
    return {
      groupJid,
      groupName,
    };
  }

  private normalizeJidField(field: EvolutionGroupPayload['id']): string {
    if (!field) {
      return '';
    }

    if (typeof field === 'string') {
      return field.trim();
    }

    if (field._serialized) {
      return field._serialized.trim();
    }

    if (field.user && field.server) {
      return `${field.user}@${field.server}`.trim();
    }

    return '';
  }

  private resolveLegacyGroupJid(organizationId: string): string | null {
    const mappingJson = this.configService.get<string>('WHATSAPP_GROUP_JID_BY_ORG')?.trim();
    if (!mappingJson) {
      return null;
    }

    try {
      const parsed = JSON.parse(mappingJson) as Record<string, string>;
      const raw = parsed?.[organizationId];
      return raw?.trim() || null;
    } catch {
      return null;
    }
  }

  private async readJsonSafe<T>(response: Response): Promise<T | null> {
    const bodyText = await response.text();
    if (!bodyText) {
      return null;
    }

    try {
      return JSON.parse(bodyText) as T;
    } catch {
      return null;
    }
  }

  private async readBodySafe(response: Response): Promise<string | null> {
    try {
      const text = await response.text();
      return text || null;
    } catch {
      return null;
    }
  }
}
