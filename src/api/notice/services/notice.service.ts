import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notice, NoticeWhatsappDeliveryStatus } from '../entities/notice.entity';
import { NoticeReadState } from '../entities/notice-read-state.entity';
import { CreateNoticeDto } from '../dto/create-notice.dto';
import { UpdateNoticeDto } from '../dto/update-notice.dto';
import { WhatsappSettingsService } from '../../whatsapp-settings/services/whatsapp-settings.service';

class WhatsappSendError extends Error {
  constructor(
    message: string,
    readonly options: { retryable: boolean; statusCode?: number; code?: string },
  ) {
    super(message);
  }
}

interface EvolutionSendResponse {
  key?: { id?: string };
  id?: string;
  message?: {
    key?: { id?: string };
  };
}

@Injectable()
export class NoticeService {
  private readonly logger = new Logger(NoticeService.name);

  constructor(
    @InjectRepository(Notice)
    private readonly noticeRepository: Repository<Notice>,
    @InjectRepository(NoticeReadState)
    private readonly noticeReadStateRepository: Repository<NoticeReadState>,
    private readonly configService: ConfigService,
    @Optional()
    private readonly whatsappSettingsService?: WhatsappSettingsService,
  ) {}

  async create(data: CreateNoticeDto, organizationId: string): Promise<Notice> {
    const autoSendEnabled = await this.resolveAutoSendNotices(organizationId);
    const shouldSendViaWhatsapp = Boolean(data.sendViaWhatsapp) || autoSendEnabled;

    const notice = this.noticeRepository.create({
      ...data,
      organizationId,
      sendViaWhatsapp: shouldSendViaWhatsapp,
      whatsappDeliveryStatus: shouldSendViaWhatsapp ? 'pending' : 'not_requested',
    });

    const savedNotice = await this.noticeRepository.save(notice);

    if (!shouldSendViaWhatsapp) {
      return savedNotice;
    }

    return this.dispatchNoticeViaWhatsapp(savedNotice.id, organizationId);
  }

  async findAll(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Notice[]; total: number }> {
    const [data, total] = await this.noticeRepository.findAndCount({
      where: { organizationId },
      take: limit,
      skip: (page - 1) * limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total };
  }

  async update(id: string, data: UpdateNoticeDto, organizationId: string): Promise<Notice> {
    const notice = await this.noticeRepository.findOne({ where: { id, organizationId } });
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }
    Object.assign(notice, data);
    return this.noticeRepository.save(notice);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const result = await this.noticeRepository.delete({ id, organizationId });
    if (result.affected === 0) {
      throw new NotFoundException('Notice not found');
    }
  }

  async getUnreadCount(
    userId: string,
    organizationId: string,
  ): Promise<{ unreadCount: number; hasUnread: boolean; lastSeenNoticesAt: string | null }> {
    const [row] = (await this.noticeReadStateRepository.query(
      `
        WITH "read_state" AS (
          SELECT "lastSeenNoticesAt"
          FROM "notice_read_state"
          WHERE "userId" = $1
            AND "organizationId" = $2
          LIMIT 1
        )
        SELECT
          (
            SELECT COUNT(*)::int
            FROM "notice" "n"
            LEFT JOIN "read_state" "rs" ON TRUE
            WHERE "n"."organizationId" = $2
              AND ("rs"."lastSeenNoticesAt" IS NULL OR "n"."createdAt" > "rs"."lastSeenNoticesAt")
          ) AS "unreadCount",
          EXISTS (
            SELECT 1
            FROM "notice" "n"
            LEFT JOIN "read_state" "rs" ON TRUE
            WHERE "n"."organizationId" = $2
              AND ("rs"."lastSeenNoticesAt" IS NULL OR "n"."createdAt" > "rs"."lastSeenNoticesAt")
          ) AS "hasUnread",
          (
            SELECT "lastSeenNoticesAt"
            FROM "read_state"
          ) AS "lastSeenNoticesAt",
          (
            SELECT EXISTS (SELECT 1 FROM "read_state")
          ) AS "hasReadStateRow"
      `,
      [userId, organizationId],
    )) as Array<{
      unreadCount: number | string;
      hasUnread: boolean | 'true' | 'false';
      lastSeenNoticesAt: string | Date | null;
      hasReadStateRow?: boolean | 'true' | 'false';
    }>;

    const unreadCountRaw = row?.unreadCount ?? 0;
    const unreadCount = typeof unreadCountRaw === 'number' ? unreadCountRaw : Number.parseInt(unreadCountRaw, 10) || 0;
    const hasUnread = row?.hasUnread === true || row?.hasUnread === 'true';
    const hasReadStateRow = row?.hasReadStateRow === true || row?.hasReadStateRow === 'true';
    const lastSeenValue = row?.lastSeenNoticesAt ?? null;
    const lastSeenNoticesAt = lastSeenValue ? new Date(lastSeenValue).toISOString() : null;

    this.logger.log(
      JSON.stringify({
        event: 'notice_unread_count_fetched',
        organizationId,
        unreadCount,
        hasUnread,
        hasReadStateRow,
      }),
    );

    return {
      unreadCount,
      hasUnread,
      lastSeenNoticesAt,
    };
  }

  async markAllAsSeen(
    userId: string,
    organizationId: string,
  ): Promise<{ markedAsSeenAt: string; previousLastSeenNoticesAt: string | null }> {
    const readState = await this.noticeReadStateRepository.findOne({
      where: { userId, organizationId },
    });
    const previousLastSeenNoticesAt = readState?.lastSeenNoticesAt
      ? readState.lastSeenNoticesAt.toISOString()
      : null;
    const [result] = (await this.noticeReadStateRepository.query(
      `
        INSERT INTO "notice_read_state" ("userId", "organizationId", "lastSeenNoticesAt")
        VALUES (
          $1,
          $2,
          (
            SELECT COALESCE(MAX("createdAt") + interval '1 microsecond', now())
            FROM "notice"
            WHERE "organizationId" = $2
          )
        )
        ON CONFLICT ("userId", "organizationId")
        DO UPDATE SET
          "lastSeenNoticesAt" = EXCLUDED."lastSeenNoticesAt",
          "updatedAt" = now()
        RETURNING "lastSeenNoticesAt"
      `,
      [userId, organizationId],
    )) as Array<{ lastSeenNoticesAt: string | Date }>;
    const seenAtValue = result?.lastSeenNoticesAt ?? new Date();
    const seenAt = new Date(seenAtValue);

    this.logger.log(
      JSON.stringify({
        event: 'notice_mark_seen_succeeded',
        organizationId,
        hadPreviousReadState: Boolean(readState),
        markedToLatestNoticeAt: true,
      }),
    );

    return {
      markedAsSeenAt: seenAt.toISOString(),
      previousLastSeenNoticesAt,
    };
  }

  private async dispatchNoticeViaWhatsapp(noticeId: string, organizationId: string): Promise<Notice> {
    const notice = await this.noticeRepository.findOne({ where: { id: noticeId, organizationId } });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    if (!notice.sendViaWhatsapp) {
      return notice;
    }

    if (notice.whatsappDeliveryStatus === 'sent' && notice.whatsappProviderMessageId) {
      this.logger.log(
        JSON.stringify({
          event: 'notice_whatsapp_send_skipped_already_sent',
          noticeId: notice.id,
          organizationId,
          providerMessageId: notice.whatsappProviderMessageId,
        }),
      );
      return notice;
    }

    const deliveryConfig = await this.resolveWhatsappDeliveryConfiguration(organizationId);
    if (!deliveryConfig) {
      return this.persistWhatsappFailure(notice, {
        status: 'skipped',
        error: 'WhatsApp group is not configured for this organization',
        retryable: false,
      });
    }

    const maxAttempts = this.readPositiveIntEnv('WHATSAPP_SEND_MAX_ATTEMPTS', 3);
    const baseBackoffMs = this.readPositiveIntEnv('WHATSAPP_SEND_BASE_BACKOFF_MS', 250);

    let current = notice;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      current = await this.noticeRepository.save({
        ...current,
        whatsappAttemptCount: attempt,
        whatsappLastAttemptAt: new Date(),
        whatsappDeliveryStatus: attempt === 1 ? 'pending' : 'retrying',
      });

      try {
        const providerResult = await this.sendToEvolutionApi({
          notice: current,
          baseUrl: deliveryConfig.baseUrl,
          instance: deliveryConfig.instanceName,
          apiKey: deliveryConfig.apiKey,
          groupJid: deliveryConfig.groupJid,
        });

        const sentNotice = await this.noticeRepository.save({
          ...current,
          whatsappDeliveryStatus: 'sent',
          whatsappSentAt: new Date(),
          whatsappProviderMessageId: providerResult.providerMessageId,
          whatsappLastError: null,
        });

        this.logger.log(
          JSON.stringify({
            event: 'notice_whatsapp_send_succeeded',
            noticeId: sentNotice.id,
            organizationId,
            attempt,
            providerMessageId: sentNotice.whatsappProviderMessageId,
          }),
        );

        return sentNotice;
      } catch (error) {
        const failure = error as WhatsappSendError;
        const canRetry = failure.options.retryable && attempt < maxAttempts;

        this.logger.warn(
          JSON.stringify({
            event: 'notice_whatsapp_send_failed',
            noticeId: current.id,
            organizationId,
            attempt,
            willRetry: canRetry,
            statusCode: failure.options.statusCode,
            code: failure.options.code,
            message: failure.message,
          }),
        );

        current = await this.noticeRepository.save({
          ...current,
          whatsappDeliveryStatus: canRetry ? 'retrying' : 'failed',
          whatsappLastError: this.trimError(
            `${failure.message}${failure.options.statusCode ? ` [status=${failure.options.statusCode}]` : ''}${
              failure.options.code ? ` [code=${failure.options.code}]` : ''
            }`,
          ),
        });

        if (!canRetry) {
          return current;
        }

        await this.sleep(baseBackoffMs * 2 ** (attempt - 1));
      }
    }

    return current;
  }

  private async sendToEvolutionApi(params: {
    notice: Notice;
    baseUrl: string;
    instance: string;
    apiKey: string;
    groupJid: string;
  }): Promise<{ providerMessageId: string | null }> {
    const endpoint = `${params.baseUrl.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(params.instance)}`;
    const timeoutMs = this.readPositiveIntEnv('WHATSAPP_SEND_TIMEOUT_MS', 8000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const message = this.composeNoticeMessage(params.notice);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: params.apiKey,
          'x-idempotency-key': params.notice.id,
        },
        body: JSON.stringify({
          number: params.groupJid,
          text: message,
        }),
        signal: controller.signal,
      });

      const responseBody = await this.readJsonSafe<EvolutionSendResponse>(response);
      if (!response.ok) {
        throw new WhatsappSendError('Provider rejected notice message', {
          retryable: this.isRetryableStatus(response.status),
          statusCode: response.status,
        });
      }

      const providerMessageId =
        responseBody?.key?.id ?? responseBody?.message?.key?.id ?? responseBody?.id ?? null;

      return { providerMessageId };
    } catch (error) {
      if (error instanceof WhatsappSendError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new WhatsappSendError('Timeout sending notice to provider', { retryable: true, code: 'timeout' });
      }

      throw new WhatsappSendError((error as Error).message || 'Unknown WhatsApp send error', {
        retryable: true,
        code: 'network_error',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private composeNoticeMessage(notice: Notice): string {
    const chunks = [
      `*${notice.title.trim()}*`,
      notice.subtitle?.trim() ? `_${notice.subtitle.trim()}_` : '',
      notice.content.trim(),
    ].filter(Boolean);

    return chunks.join('\n\n');
  }

  private resolveOrganizationGroupJid(organizationId: string): string | null {
    const mappingJson = this.configService.get<string>('WHATSAPP_GROUP_JID_BY_ORG')?.trim();
    if (!mappingJson) {
      return null;
    }

    try {
      const parsed = JSON.parse(mappingJson) as Record<string, string>;
      const raw = parsed?.[organizationId];
      return raw?.trim() || null;
    } catch {
      this.logger.error(
        JSON.stringify({
          event: 'notice_whatsapp_group_mapping_invalid',
          organizationId,
        }),
      );
      return null;
    }
  }

  private async resolveWhatsappDeliveryConfiguration(
    organizationId: string,
  ): Promise<{ baseUrl: string; instanceName: string; apiKey: string; groupJid: string } | null> {
    if (this.whatsappSettingsService) {
      const dbConfig = await this.whatsappSettingsService.getDeliveryConfigForFeature(organizationId, 'notices');
      if (dbConfig) {
        return {
          baseUrl: dbConfig.baseUrl,
          instanceName: dbConfig.instanceName,
          apiKey: dbConfig.apiKey,
          groupJid: dbConfig.groupJid,
        };
      }
    }

    const groupJid = this.resolveOrganizationGroupJid(organizationId);
    const baseUrl = this.configService.get<string>('WHATSAPP_EVOLUTION_BASE_URL')?.trim();
    const instanceName = this.configService.get<string>('WHATSAPP_EVOLUTION_INSTANCE')?.trim();
    const apiKey = this.configService.get<string>('WHATSAPP_EVOLUTION_API_KEY')?.trim();

    if (!groupJid || !baseUrl || !instanceName || !apiKey) {
      return null;
    }

    return {
      baseUrl,
      instanceName,
      apiKey,
      groupJid,
    };
  }

  private async resolveAutoSendNotices(organizationId: string): Promise<boolean> {
    if (!this.whatsappSettingsService) {
      return false;
    }
    return this.whatsappSettingsService.isAutoSendNoticesEnabled(organizationId);
  }

  private async persistWhatsappFailure(
    notice: Notice,
    details: { status: NoticeWhatsappDeliveryStatus; error: string; retryable: boolean },
  ): Promise<Notice> {
    const failedNotice = await this.noticeRepository.save({
      ...notice,
      whatsappDeliveryStatus: details.status,
      whatsappLastError: this.trimError(details.error),
    });

    this.logger.warn(
      JSON.stringify({
        event: 'notice_whatsapp_send_not_attempted',
        noticeId: notice.id,
        organizationId: notice.organizationId,
        status: details.status,
        retryable: details.retryable,
        reason: details.error,
      }),
    );

    return failedNotice;
  }

  private readPositiveIntEnv(name: string, fallback: number): number {
    const value = this.configService.get<string>(name);
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private isRetryableStatus(status: number): boolean {
    return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
  }

  private trimError(value: string): string {
    return value.slice(0, 900);
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
