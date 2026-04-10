import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import {
  OrganizationWhatsappIntegration,
  WhatsappIntegrationStatus,
} from '../entities/organization-whatsapp-integration.entity';
import { OrganizationWhatsappGroupBinding } from '../entities/organization-whatsapp-group-binding.entity';
import {
  OnboardingStatusQueryDto,
  TestWhatsappConnectionDto,
  UpdateWhatsappSettingsDto,
  UpsertWhatsappGroupBindingDto,
  WhatsappGroupBindingDto,
  WhatsappGroupOptionDto,
  WhatsappOnboardingState,
  WhatsappOnboardingStatusDto,
  WhatsappSettingsViewDto,
} from '../dto/whatsapp-settings.dto';

interface EvolutionGroupPayload {
  id?: string | { _serialized?: string; user?: string; server?: string };
  jid?: string | { _serialized?: string; user?: string; server?: string };
  subject?: string;
  name?: string;
  notify?: string;
}

interface EvolutionInstancePayload {
  instance?: {
    instanceName?: string;
    state?: string;
  };
  name?: string;
  connectionStatus?: string;
  status?: string;
}

interface EvolutionConnectPayload {
  base64?: string;
  qrcode?: string;
  code?: string;
  qr?: string;
  pairingCode?: string;
  expiresIn?: number;
  ttl?: number;
  count?: number;
}

@Injectable()
export class WhatsappSettingsService {
  private readonly logger = new Logger(WhatsappSettingsService.name);
  private static readonly DEFAULT_PROVIDER_TIMEOUT_MS = 20000;
  private static readonly DEFAULT_GROUP_FETCH_TIMEOUT_MS = 60000;
  private static readonly DEFAULT_QR_TTL_SECONDS = 60;
  private static readonly ONBOARDING_STATUS_ENDPOINT = '/whatsapp/settings/onboarding/status';

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
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
    const hasApiKeyField = Object.prototype.hasOwnProperty.call(data, 'apiKey');
    const normalizedApiKey = typeof data.apiKey === 'string' ? data.apiKey.trim() : '';
    const resolvedApiKey = hasApiKeyField ? normalizedApiKey : existing?.apiKey ?? '';

    const integration = this.integrationRepository.create({
      id: existing?.id,
      organizationId,
      provider: 'evolution',
      baseUrl: data.baseUrl.trim(),
      instanceName: data.instanceName.trim(),
      apiKey: resolvedApiKey,
      whatsappNumber: data.whatsappNumber?.trim() || null,
      autoSendNotices: Boolean(data.autoSendNotices),
      status: this.resolveStatus(resolvedApiKey),
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
    let response: Response;
    try {
      response = await this.fetchProviderWithTimeout(endpoint, {
        method: 'GET',
        headers: {
          apikey: resolved.apiKey,
        },
      });
    } catch (error) {
      await this.integrationRepository.update(
        { organizationId },
        {
          status: 'disconnected',
        },
      );
      throw error;
    }

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

  async startOnboarding(organizationId: string): Promise<WhatsappOnboardingStatusDto> {
    const integration = await this.ensureOnboardingIntegration(organizationId);
    await this.ensureProviderInstance(integration);

    return this.resolveOnboardingSnapshot(integration, { forceQr: true });
  }

  async getOnboardingStatus(
    organizationId: string,
    query?: OnboardingStatusQueryDto,
  ): Promise<WhatsappOnboardingStatusDto> {
    const integration = await this.integrationRepository.findOne({ where: { organizationId } });
    if (!integration) {
      return {
        state: 'failed',
        status: 'disconnected',
        instanceName: '',
        qrCodeBase64: null,
        ttlSeconds: null,
        statusEndpoint: WhatsappSettingsService.ONBOARDING_STATUS_ENDPOINT,
        maskedWhatsappNumber: null,
      };
    }

    return this.resolveOnboardingSnapshot(integration, { forceQr: Boolean(query?.forceQr) });
  }

  async refreshOnboardingQr(organizationId: string): Promise<WhatsappOnboardingStatusDto> {
    const integration = await this.ensureOnboardingIntegration(organizationId);
    await this.ensureProviderInstance(integration);
    return this.resolveOnboardingSnapshot(integration, { forceQr: true });
  }

  async disconnectOnboarding(organizationId: string): Promise<{ ok: true }> {
    const integration = await this.integrationRepository.findOne({ where: { organizationId } });
    if (!integration) {
      return { ok: true };
    }

    await this.callProviderWithFallback(
      [
        `/instance/logout/${encodeURIComponent(integration.instanceName)}`,
        `/instance/disconnect/${encodeURIComponent(integration.instanceName)}`,
      ],
      integration.baseUrl,
      {
        method: 'DELETE',
        headers: {
          apikey: integration.apiKey,
        },
      },
      { allow404: true },
    );

    await this.integrationRepository.save({
      ...integration,
      status: 'disconnected',
      autoSendNotices: false,
    });

    await this.bindingRepository.delete({ organizationId });
    return { ok: true };
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

    const endpoint = `${
      credentials.baseUrl.replace(/\/+$/, '')
    }/group/fetchAllGroups/${encodeURIComponent(credentials.instanceName)}?getParticipants=false`;
    let response: Response;
    try {
      response = await this.fetchProviderWithTimeout(endpoint, {
        method: 'GET',
        headers: {
          apikey: credentials.apiKey,
        },
      }, this.readGroupFetchTimeoutMs());
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'whatsapp_group_fetch_failed',
          organizationId,
          timedOut: error instanceof BadGatewayException && String(error.message).includes('timed out'),
          message: (error as Error).message,
        }),
      );
      throw error;
    }

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

  private async ensureOnboardingIntegration(organizationId: string): Promise<OrganizationWhatsappIntegration> {
    const existing = await this.integrationRepository.findOne({ where: { organizationId } });
    if (existing?.baseUrl && existing.apiKey && existing.instanceName) {
      return existing;
    }

    const baseUrl = this.configService.get<string>('WHATSAPP_EVOLUTION_BASE_URL')?.trim();
    const apiKey = this.configService.get<string>('WHATSAPP_EVOLUTION_API_KEY')?.trim();
    if (!baseUrl || !apiKey) {
      throw new NotFoundException('WhatsApp provider configuration is not available');
    }

    const resolvedInstanceName = existing?.instanceName?.trim() || await this.resolveOrganizationInstanceName(organizationId);
    const integration = this.integrationRepository.create({
      id: existing?.id,
      organizationId,
      provider: 'evolution',
      baseUrl,
      instanceName: resolvedInstanceName,
      apiKey,
      whatsappNumber: existing?.whatsappNumber ?? null,
      autoSendNotices: existing?.autoSendNotices ?? false,
      status: existing?.status ?? 'disconnected',
    });

    return this.integrationRepository.save(integration);
  }

  private async resolveOrganizationInstanceName(organizationId: string): Promise<string> {
    const organization = await this.organizationRepository.findOne({ where: { id: organizationId } });
    const rawSeed = organization?.slug?.trim() || `org-${organizationId.slice(0, 8)}`;
    const normalizedSeed = rawSeed
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    const prefix = this.configService.get<string>('WHATSAPP_INSTANCE_PREFIX')?.trim() || 'grillrent';
    const baseName = `${prefix}-${normalizedSeed || 'org'}`.slice(0, 120);
    return baseName;
  }

  private async ensureProviderInstance(integration: OrganizationWhatsappIntegration): Promise<void> {
    const exists = await this.providerInstanceExists(integration);
    if (exists) {
      return;
    }

    const createResponse = await this.callProviderWithFallback(
      ['/instance/create'],
      integration.baseUrl,
      {
        method: 'POST',
        headers: {
          apikey: integration.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: integration.instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      },
    );

    if (!createResponse || !createResponse.ok) {
      throw new BadGatewayException(
        `Unable to create WhatsApp provider instance (status ${createResponse?.status ?? 'unknown'})`,
      );
    }
  }

  private async providerInstanceExists(integration: OrganizationWhatsappIntegration): Promise<boolean> {
    const endpoint = `${integration.baseUrl.replace(/\/+$/, '')}/instance/fetchInstances`;
    const response = await this.fetchProviderWithTimeout(endpoint, {
      method: 'GET',
      headers: {
        apikey: integration.apiKey,
      },
    });

    if (!response.ok) {
      return false;
    }

    const payload = (await this.readJsonSafe<unknown>(response)) ?? [];
    const rows = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object'
        ? ((payload as Record<string, unknown>).data as unknown[]) || []
        : [];

    const target = integration.instanceName.trim().toLowerCase();
    return rows.some((row) => {
      if (!row || typeof row !== 'object') {
        return false;
      }
      const normalized = row as EvolutionInstancePayload;
      const name = normalized.instance?.instanceName || normalized.name;
      return String(name || '').trim().toLowerCase() === target;
    });
  }

  private async resolveOnboardingSnapshot(
    integration: OrganizationWhatsappIntegration,
    options?: { forceQr?: boolean },
  ): Promise<WhatsappOnboardingStatusDto> {
    const connection = await this.getProviderConnectionState(integration);
    const connectionState = this.normalizeConnectionState(connection?.instance?.state || connection?.connectionStatus || connection?.status);

    if (connectionState === 'connected') {
      const saved = await this.integrationRepository.save({
        ...integration,
        status: 'connected',
      });
      return {
        state: await this.resolveConnectedOnboardingState(saved.organizationId),
        status: 'connected',
        instanceName: saved.instanceName,
        qrCodeBase64: null,
        ttlSeconds: null,
        statusEndpoint: WhatsappSettingsService.ONBOARDING_STATUS_ENDPOINT,
        maskedWhatsappNumber: this.maskWhatsappNumber(saved.whatsappNumber ?? null),
      };
    }

    const qrPayload = await this.getProviderQr(integration, Boolean(options?.forceQr));
    await this.integrationRepository.save({
      ...integration,
      status: 'disconnected',
    });

    return {
      state: qrPayload.qrCodeBase64 ? 'qr_ready' : 'connecting',
      status: 'disconnected',
      instanceName: integration.instanceName,
      qrCodeBase64: qrPayload.qrCodeBase64,
      ttlSeconds: qrPayload.ttlSeconds,
      statusEndpoint: WhatsappSettingsService.ONBOARDING_STATUS_ENDPOINT,
      maskedWhatsappNumber: this.maskWhatsappNumber(integration.whatsappNumber ?? null),
    };
  }

  private async resolveConnectedOnboardingState(organizationId: string): Promise<WhatsappOnboardingState> {
    const noticeBinding = await this.bindingRepository.findOne({
      where: { organizationId, feature: 'notices' },
    });
    return noticeBinding?.groupJid ? 'active' : 'group_selection';
  }

  private normalizeConnectionState(value?: string): 'connected' | 'connecting' | 'disconnected' {
    const raw = String(value || '').trim().toLowerCase();
    if (['open', 'connected'].includes(raw)) {
      return 'connected';
    }
    if (['connecting', 'pairing', 'starting'].includes(raw)) {
      return 'connecting';
    }
    return 'disconnected';
  }

  private async getProviderConnectionState(integration: OrganizationWhatsappIntegration): Promise<EvolutionInstancePayload | null> {
    const response = await this.callProviderWithFallback(
      [
        `/instance/connectionState/${encodeURIComponent(integration.instanceName)}`,
        `/instance/connection-state/${encodeURIComponent(integration.instanceName)}`,
      ],
      integration.baseUrl,
      {
        method: 'GET',
        headers: {
          apikey: integration.apiKey,
        },
      },
      { allow404: true },
    );

    if (!response) {
      return null;
    }

    return (await this.readJsonSafe<EvolutionInstancePayload>(response)) ?? null;
  }

  private async getProviderQr(
    integration: OrganizationWhatsappIntegration,
    forceRefresh: boolean,
  ): Promise<{ qrCodeBase64: string | null; ttlSeconds: number }> {
    const response = await this.callProviderWithFallback(
      [
        `/instance/connect/${encodeURIComponent(integration.instanceName)}`,
        `/instance/qr/${encodeURIComponent(integration.instanceName)}`,
      ],
      integration.baseUrl,
      {
        method: forceRefresh ? 'POST' : 'GET',
        headers: {
          apikey: integration.apiKey,
        },
      },
      { allow404: true },
    );

    if (!response) {
      return {
        qrCodeBase64: null,
        ttlSeconds: WhatsappSettingsService.DEFAULT_QR_TTL_SECONDS,
      };
    }

    if (!response.ok) {
      throw new BadGatewayException(`Unable to fetch WhatsApp QR code from provider (status ${response.status})`);
    }

    const payload = (await this.readJsonSafe<EvolutionConnectPayload>(response)) ?? {};
    const qrCodeBase64 = payload.base64 || payload.qrcode || payload.code || payload.qr || null;
    const ttlSeconds = Number(payload.expiresIn || payload.ttl || payload.count || WhatsappSettingsService.DEFAULT_QR_TTL_SECONDS);
    return {
      qrCodeBase64,
      ttlSeconds: Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.floor(ttlSeconds) : WhatsappSettingsService.DEFAULT_QR_TTL_SECONDS,
    };
  }

  private async callProviderWithFallback(
    endpoints: string[],
    baseUrl: string,
    init: RequestInit,
    options?: { allow404?: boolean },
  ): Promise<Response | null> {
    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
        ? endpoint
        : `${baseUrl.replace(/\/+$/, '')}${endpoint}`;
      try {
        const response = await this.fetchProviderWithTimeout(url, init);
        if (response.status === 404 && options?.allow404) {
          continue;
        }
        return response;
      } catch (error) {
        lastError = error as Error;
      }
    }

    if (lastError) {
      throw lastError;
    }
    return null;
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

  private maskWhatsappNumber(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const digits = value.replace(/\D+/g, '');
    if (!digits) {
      return null;
    }
    if (digits.length <= 4) {
      return `••••${digits}`;
    }
    return `••••${digits.slice(-4)}`;
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

  private async fetchProviderWithTimeout(url: string, init: RequestInit, timeoutMs = this.readProviderTimeoutMs()): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new BadGatewayException(`WhatsApp provider request timed out after ${timeoutMs}ms`);
      }
      throw new BadGatewayException('Unable to reach WhatsApp provider');
    } finally {
      clearTimeout(timeout);
    }
  }

  private readProviderTimeoutMs(): number {
    const raw = this.configService.get<string>('WHATSAPP_PROVIDER_TIMEOUT_MS');
    const parsed = Number.parseInt(raw || '', 10);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : WhatsappSettingsService.DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  private readGroupFetchTimeoutMs(): number {
    const raw = this.configService.get<string>('WHATSAPP_GROUP_FETCH_TIMEOUT_MS');
    const parsed = Number.parseInt(raw || '', 10);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : WhatsappSettingsService.DEFAULT_GROUP_FETCH_TIMEOUT_MS;
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
