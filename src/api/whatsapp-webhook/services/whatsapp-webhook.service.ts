import { UnauthorizedException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Notice } from '../../notice/entities/notice.entity';
import { OrganizationWhatsappGroupBinding } from '../../whatsapp-settings/entities/organization-whatsapp-group-binding.entity';
import { OrganizationWhatsappIntegration } from '../../whatsapp-settings/entities/organization-whatsapp-integration.entity';
import { NoticeWhatsappInboundEvent } from '../entities/notice-whatsapp-inbound-event.entity';

interface ExtractedInboundMessage {
  eventName: string;
  providerMessageId: string | null;
  groupJid: string;
  senderJid: string;
  senderName: string | null;
  text: string | null;
  timestamp: Date | null;
}

interface WebhookHandleResult {
  ok: boolean;
  status:
    | 'ignored_invalid_payload'
    | 'ignored_non_group_message'
    | 'ignored_group_not_bound'
    | 'duplicate'
    | 'ignored_not_admin'
    | 'ignored_no_text'
    | 'created';
  reason?: string;
  noticeId?: string;
}

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);
  private static readonly DEFAULT_PROVIDER_TIMEOUT_MS = 8000;
  private static readonly GROUP_ADMIN_CACHE_TTL_MS = 30_000;
  private static readonly GROUP_ADMIN_CACHE_MAX_SIZE = 500;
  private readonly groupAdminCache = new Map<string, { adminIds: Set<string>; expiresAt: number }>();

  constructor(
    @InjectRepository(Notice)
    private readonly noticeRepository: Repository<Notice>,
    @InjectRepository(OrganizationWhatsappGroupBinding)
    private readonly groupBindingRepository: Repository<OrganizationWhatsappGroupBinding>,
    @InjectRepository(OrganizationWhatsappIntegration)
    private readonly integrationRepository: Repository<OrganizationWhatsappIntegration>,
    @InjectRepository(NoticeWhatsappInboundEvent)
    private readonly inboundEventRepository: Repository<NoticeWhatsappInboundEvent>,
    private readonly configService: ConfigService,
  ) {}

  async handleEvolutionWebhook(payload: unknown, webhookSecret?: string): Promise<WebhookHandleResult> {
    this.assertWebhookSecret(webhookSecret);

    const extracted = this.extractInboundMessage(payload);
    if (!extracted) {
      return { ok: true, status: 'ignored_invalid_payload', reason: 'payload does not include a valid WhatsApp message' };
    }

    const normalizedGroupJid = this.normalizeJid(extracted.groupJid);
    if (!normalizedGroupJid.endsWith('@g.us')) {
      return { ok: true, status: 'ignored_non_group_message', reason: 'message is not from a WhatsApp group' };
    }

    const binding = await this.groupBindingRepository
      .createQueryBuilder('binding')
      .where('LOWER(binding.groupJid) = :groupJid', { groupJid: normalizedGroupJid.toLowerCase() })
      .andWhere('binding.feature = :feature', { feature: 'notices' })
      .getOne();

    if (!binding) {
      return { ok: true, status: 'ignored_group_not_bound', reason: 'group is not bound to notices feature' };
    }

    const providerMessageId =
      extracted.providerMessageId?.trim() ||
      this.computeFallbackMessageId(normalizedGroupJid, extracted.senderJid, extracted.text, extracted.timestamp);

    const inboundEvent = this.inboundEventRepository.create({
      organizationId: binding.organizationId,
      providerEvent: this.trim(extracted.eventName, 64),
      providerMessageId: this.trim(providerMessageId, 191),
      groupJid: this.trim(normalizedGroupJid, 191),
      senderJid: this.trim(extracted.senderJid, 191),
      senderName: this.trim(extracted.senderName || '', 180) || null,
      messageText: extracted.text || null,
      messageTimestamp: extracted.timestamp,
      rawPayload: this.toObjectOrNull(payload),
    });

    let savedInboundEvent: NoticeWhatsappInboundEvent;
    try {
      savedInboundEvent = await this.inboundEventRepository.save(inboundEvent);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return { ok: true, status: 'duplicate' };
      }
      throw error;
    }

    const integration = await this.integrationRepository.findOne({ where: { id: binding.integrationId } });
    if (!integration) {
      await this.markInboundEventIgnored(savedInboundEvent, 'integration_not_found');
      return { ok: true, status: 'ignored_group_not_bound', reason: 'integration for binding was not found' };
    }

    const senderIsAdmin = await this.isSenderGroupAdmin({
      integration,
      groupJid: normalizedGroupJid,
      senderJid: extracted.senderJid,
    });

    if (!senderIsAdmin) {
      await this.markInboundEventIgnored(savedInboundEvent, 'sender_is_not_group_admin');
      return { ok: true, status: 'ignored_not_admin' };
    }

    const normalizedText = extracted.text?.trim() || '';
    if (!normalizedText) {
      await this.markInboundEventIgnored(savedInboundEvent, 'message_has_no_text');
      return { ok: true, status: 'ignored_no_text' };
    }

    const notice = this.noticeRepository.create({
      title: 'Aviso da administracao (WhatsApp)',
      subtitle: this.trim(`Enviado por ${extracted.senderName?.trim() || extracted.senderJid}`, 255),
      content: normalizedText,
      organizationId: binding.organizationId,
      sendViaWhatsapp: false,
      whatsappDeliveryStatus: 'not_requested',
    });
    const savedNotice = await this.noticeRepository.save(notice);

    await this.inboundEventRepository.save({
      ...savedInboundEvent,
      processedAsNotice: true,
      noticeId: savedNotice.id,
      ignoredReason: null,
    });

    this.logger.log(
      JSON.stringify({
        event: 'notice_whatsapp_inbound_created',
        organizationId: binding.organizationId,
        groupJid: normalizedGroupJid,
        noticeId: savedNotice.id,
        providerMessageId,
      }),
    );

    return { ok: true, status: 'created', noticeId: savedNotice.id };
  }

  private assertWebhookSecret(receivedSecret?: string): void {
    const expectedSecret = this.configService.get<string>('WHATSAPP_EVOLUTION_WEBHOOK_SECRET')?.trim();
    if (!expectedSecret) {
      throw new UnauthorizedException('Webhook secret is not configured');
    }

    if (!receivedSecret || receivedSecret.trim() !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  private async markInboundEventIgnored(event: NoticeWhatsappInboundEvent, reason: string): Promise<void> {
    await this.inboundEventRepository.save({
      ...event,
      ignoredReason: this.trim(reason, 160),
      processedAsNotice: false,
    });
  }

  private async isSenderGroupAdmin(params: {
    integration: OrganizationWhatsappIntegration;
    groupJid: string;
    senderJid: string;
  }): Promise<boolean> {
    const senderId = this.normalizeActorId(params.senderJid);
    if (!senderId) {
      return false;
    }

    const fallbackAdminNumber = this.normalizeActorId(params.integration.whatsappNumber || '');
    if (fallbackAdminNumber && fallbackAdminNumber === senderId) {
      return true;
    }

    const now = Date.now();
    const cacheKey = `${params.integration.id}:${this.normalizeJid(params.groupJid).toLowerCase()}`;
    this.pruneGroupAdminCache(now);
    const cachedEntry = this.groupAdminCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > now) {
      return cachedEntry.adminIds.has(senderId);
    }

    const endpoint = `${
      params.integration.baseUrl.replace(/\/+$/, '')
    }/group/fetchAllGroups/${encodeURIComponent(params.integration.instanceName)}?getParticipants=true`;
    const timeoutMs = this.readProviderTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: params.integration.apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(
          JSON.stringify({
            event: 'notice_whatsapp_inbound_admin_check_failed',
            groupJid: params.groupJid,
            statusCode: response.status,
          }),
        );
        return false;
      }

      const payload = await this.readJsonSafe<unknown>(response);
      const group = this.findGroupInPayload(payload, params.groupJid);
      if (!group) {
        return false;
      }

      const participants = this.extractGroupParticipants(group);
      if (participants.length === 0) {
        return false;
      }
      const adminIds = new Set<string>();
      for (const participant of participants) {
        if (!this.isParticipantAdmin(participant)) {
          continue;
        }

        const participantId = this.normalizeActorId(this.extractParticipantJid(participant));
        if (participantId) {
          adminIds.add(participantId);
        }
      }

      if (adminIds.size > 0) {
        this.groupAdminCache.set(cacheKey, {
          adminIds,
          expiresAt: now + WhatsappWebhookService.GROUP_ADMIN_CACHE_TTL_MS,
        });
        this.pruneGroupAdminCache(now);
      }

      return adminIds.has(senderId);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'notice_whatsapp_inbound_admin_check_exception',
          groupJid: params.groupJid,
          timedOut: (error as Error).name === 'AbortError',
          message: (error as Error).message,
        }),
      );
      if (cachedEntry) {
        return cachedEntry.adminIds.has(senderId);
      }
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private pruneGroupAdminCache(now: number): void {
    for (const [key, entry] of this.groupAdminCache.entries()) {
      if (entry.expiresAt <= now) {
        this.groupAdminCache.delete(key);
      }
    }

    if (this.groupAdminCache.size <= WhatsappWebhookService.GROUP_ADMIN_CACHE_MAX_SIZE) {
      return;
    }

    const keys = this.groupAdminCache.keys();
    while (this.groupAdminCache.size > WhatsappWebhookService.GROUP_ADMIN_CACHE_MAX_SIZE) {
      const next = keys.next();
      if (next.done) {
        break;
      }
      this.groupAdminCache.delete(next.value);
    }
  }

  private findGroupInPayload(payload: unknown, expectedGroupJid: string): Record<string, unknown> | null {
    const groups = this.extractGroupRows(payload);
    const normalizedTarget = this.normalizeJid(expectedGroupJid).toLowerCase();

    for (const group of groups) {
      const rawId = this.pickString(group, ['id', 'jid']);
      const normalizedId = this.normalizeJid(rawId).toLowerCase();
      if (normalizedId && normalizedId === normalizedTarget) {
        return group;
      }
    }

    return null;
  }

  private extractGroupRows(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) {
      return payload.filter((row): row is Record<string, unknown> => this.isRecord(row));
    }

    if (!this.isRecord(payload)) {
      return [];
    }

    const candidates = [payload.groups, payload.data, payload.result, payload.response];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter((row): row is Record<string, unknown> => this.isRecord(row));
      }
      if (this.isRecord(candidate) && Array.isArray(candidate.groups)) {
        return candidate.groups.filter((row): row is Record<string, unknown> => this.isRecord(row));
      }
    }

    return [];
  }

  private extractGroupParticipants(group: Record<string, unknown>): Record<string, unknown>[] {
    const direct = group.participants;
    if (Array.isArray(direct)) {
      return direct.filter((row): row is Record<string, unknown> => this.isRecord(row));
    }

    const metadata = this.pickRecord(group, ['metadata']);
    if (metadata && Array.isArray(metadata.participants)) {
      return metadata.participants.filter((row): row is Record<string, unknown> => this.isRecord(row));
    }

    return [];
  }

  private extractParticipantJid(participant: Record<string, unknown>): string {
    const direct = this.pickString(participant, ['id', 'jid', 'participant', 'user']);
    if (direct) {
      return direct;
    }

    const nestedId = this.pickRecord(participant, ['id']);
    if (nestedId) {
      const serialized = this.pickString(nestedId, ['_serialized']);
      if (serialized) {
        return serialized;
      }

      const nestedUser = this.pickString(nestedId, ['user']);
      const nestedServer = this.pickString(nestedId, ['server']);
      if (nestedUser && nestedServer) {
        return `${nestedUser}@${nestedServer}`;
      }
    }

    return '';
  }

  private isParticipantAdmin(participant: Record<string, unknown>): boolean {
    const adminMode = this.pickString(participant, ['admin', 'role']).toLowerCase();
    if (adminMode === 'admin' || adminMode === 'superadmin' || adminMode === 'super_admin') {
      return true;
    }

    const boolFlags = [
      participant.admin,
      participant.isAdmin,
      participant.isSuperAdmin,
      participant.superAdmin,
      participant.groupAdmin,
      participant.isGroupAdmin,
    ];

    return boolFlags.some((flag) => flag === true);
  }

  private extractInboundMessage(payload: unknown): ExtractedInboundMessage | null {
    const envelope = this.toObjectOrNull(payload);
    if (!envelope) {
      return null;
    }

    const eventName = this.pickString(envelope, ['event', 'type']) || 'unknown';
    const messageNode = this.locateMessageNode(envelope);
    if (!messageNode) {
      return null;
    }

    const keyNode = this.pickRecord(messageNode, ['key']) || {};
    const groupJid = this.pickString(keyNode, ['remoteJid']) || this.pickString(messageNode, ['remoteJid', 'chatId']);
    if (!groupJid) {
      return null;
    }

    const senderJid =
      this.pickString(keyNode, ['participant']) ||
      this.pickString(messageNode, ['participant', 'sender', 'senderJid']) ||
      '';
    if (!senderJid) {
      return null;
    }

    const providerMessageId = this.pickString(keyNode, ['id']) || this.pickString(messageNode, ['id']);
    const senderName = this.pickString(messageNode, ['pushName', 'senderName']) || this.pickString(envelope, ['pushName']);
    const text = this.extractMessageText(messageNode);
    const timestamp = this.extractTimestamp(messageNode, envelope);

    return {
      eventName,
      providerMessageId: providerMessageId || null,
      groupJid,
      senderJid,
      senderName: senderName || null,
      text,
      timestamp,
    };
  }

  private locateMessageNode(envelope: Record<string, unknown>): Record<string, unknown> | null {
    const data = this.pickRecord(envelope, ['data']);
    if (!data) {
      return null;
    }

    if (this.pickRecord(data, ['key']) && this.pickRecord(data, ['message'])) {
      return data;
    }

    if (Array.isArray(data.messages)) {
      const row = data.messages.find((item) => this.isRecord(item)) as Record<string, unknown> | undefined;
      if (row) {
        return row;
      }
    }

    if (Array.isArray(data.data)) {
      const row = data.data.find((item) => this.isRecord(item)) as Record<string, unknown> | undefined;
      if (row) {
        return row;
      }
    }

    if (Array.isArray(envelope.messages)) {
      const row = envelope.messages.find((item) => this.isRecord(item)) as Record<string, unknown> | undefined;
      if (row) {
        return row;
      }
    }

    return this.isRecord(data.message) ? data : null;
  }

  private extractMessageText(messageNode: Record<string, unknown>): string | null {
    const message = this.pickRecord(messageNode, ['message']);
    if (!message) {
      return null;
    }

    const conversation = this.pickString(message, ['conversation']);
    if (conversation) {
      return conversation;
    }

    const extendedText = this.pickRecord(message, ['extendedTextMessage']);
    const extendedTextValue = extendedText ? this.pickString(extendedText, ['text']) : '';
    if (extendedTextValue) {
      return extendedTextValue;
    }

    const imageMessage = this.pickRecord(message, ['imageMessage']);
    const imageCaption = imageMessage ? this.pickString(imageMessage, ['caption']) : '';
    if (imageCaption) {
      return imageCaption;
    }

    const videoMessage = this.pickRecord(message, ['videoMessage']);
    const videoCaption = videoMessage ? this.pickString(videoMessage, ['caption']) : '';
    if (videoCaption) {
      return videoCaption;
    }

    return null;
  }

  private extractTimestamp(messageNode: Record<string, unknown>, envelope: Record<string, unknown>): Date | null {
    const candidates = [
      messageNode.messageTimestamp,
      messageNode.timestamp,
      this.pickRecord(messageNode, ['key'])?.messageTimestamp,
      this.pickRecord(envelope, ['data'])?.messageTimestamp,
      envelope.messageTimestamp,
      envelope.timestamp,
    ];

    for (const value of candidates) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        const ms = value > 10_000_000_000 ? value : value * 1000;
        return new Date(ms);
      }
      if (typeof value === 'string' && value.trim()) {
        const parsedNumber = Number.parseInt(value, 10);
        if (Number.isFinite(parsedNumber)) {
          const ms = parsedNumber > 10_000_000_000 ? parsedNumber : parsedNumber * 1000;
          return new Date(ms);
        }
        const asDate = new Date(value);
        if (!Number.isNaN(asDate.getTime())) {
          return asDate;
        }
      }
    }

    return null;
  }

  private computeFallbackMessageId(groupJid: string, senderJid: string, text: string | null, timestamp: Date | null): string {
    const fingerprint = `${groupJid}|${senderJid}|${text || ''}|${timestamp?.toISOString() || 'no_ts'}`;
    return createHash('sha256').update(fingerprint).digest('hex');
  }

  private normalizeJid(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeActorId(value: string): string {
    const jid = this.normalizeJid(value);
    if (!jid) {
      return '';
    }

    const [user] = jid.split('@');
    return user.replace(/\D/g, '');
  }

  private trim(value: string, max: number): string {
    return value.slice(0, max);
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const maybePgError = error as QueryFailedError & { code?: string };
    return maybePgError.code === '23505';
  }

  private toObjectOrNull(value: unknown): Record<string, unknown> | null {
    if (!this.isRecord(value)) {
      return null;
    }
    return value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private pickString(source: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (this.isRecord(value)) {
        const serialized = value._serialized;
        if (typeof serialized === 'string' && serialized.trim()) {
          return serialized.trim();
        }
        const user = value.user;
        const server = value.server;
        if (typeof user === 'string' && typeof server === 'string' && user.trim() && server.trim()) {
          return `${user.trim()}@${server.trim()}`;
        }
      }
    }
    return '';
  }

  private pickRecord(source: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
    for (const key of keys) {
      const value = source[key];
      if (this.isRecord(value)) {
        return value;
      }
    }
    return null;
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

  private readProviderTimeoutMs(): number {
    const raw = this.configService.get<string>('WHATSAPP_PROVIDER_TIMEOUT_MS');
    const parsed = Number.parseInt(raw || '', 10);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : WhatsappWebhookService.DEFAULT_PROVIDER_TIMEOUT_MS;
  }
}
