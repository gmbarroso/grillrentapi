import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../user/entities/user.entity';
import { EmailService, type SendEmailAttachmentInput } from '../../../shared/email/email.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { QueryMessagesDto } from '../dto/query-messages.dto';
import { Message, MessageEmailDeliveryStatus } from '../entities/message.entity';
import { MessageReply } from '../entities/message-reply.entity';
import { ContactEmailSettingsService } from './contact-email-settings.service';
import { IngestInboundEmailReplyDto } from '../dto/ingest-inbound-email-reply.dto';
import { EmailReplyTokenService } from './email-reply-token.service';

interface MessageUnreadState {
  unreadCount: number;
  hasUnread: boolean;
}

interface ResolvedInboundThread {
  messageId: string;
  organizationId: string;
  expectedSenderEmail: string | null;
  resolutionMethod: 'header' | 'reply_token' | 'direct_payload';
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageReply)
    private readonly messageReplyRepository: Repository<MessageReply>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly contactEmailSettingsService: ContactEmailSettingsService,
    private readonly configService: ConfigService,
    private readonly emailReplyTokenService: EmailReplyTokenService,
  ) {}

  async createFromContact(
    data: CreateMessageDto,
    userId: string,
    organizationId: string,
  ): Promise<Message> {
    const sender = await this.userRepository.findOne({ where: { id: userId, organizationId } });
    if (!sender) {
      throw new NotFoundException('Authenticated user not found');
    }
    if (sender.role === UserRole.RESIDENT && this.isOnboardingRequired(sender)) {
      throw new ForbiddenException('Complete onboarding before accessing contact messaging');
    }

    const message = this.messageRepository.create({
      subject: data.subject.trim(),
      category: data.category,
      content: data.content.trim(),
      attachments: data.attachments?.map((attachment) => attachment.trim()) || null,
      status: 'unread',
      senderUserId: sender.id,
      senderName: sender.name,
      senderEmail: sender.email ?? '',
      senderApartment: sender.apartment || null,
      senderBlock: sender.block ?? null,
      organizationId,
      adminEmailDeliveryStatus: 'pending',
    });

    const saved = await this.messageRepository.save(message);
    const emailResult = await this.dispatchAdminContactEmail(saved);

    await this.messageRepository.update(saved.id, {
      adminEmailDeliveryStatus: emailResult.status,
      adminEmailProviderMessageId: emailResult.providerMessageId,
      adminEmailSentAt: emailResult.status === 'sent' ? new Date() : null,
      adminEmailLastError: emailResult.errorMessage,
    });

    const updated = await this.findById(saved.id, organizationId);

    this.logger.log(
      JSON.stringify({
        event: 'contact_message_delivery_processed',
        messageId: updated.id,
        organizationId,
        deliveryMode: emailResult.deliveryMode,
        emailStatus: emailResult.status,
        reason: emailResult.reason || null,
      }),
    );

    return updated;
  }

  async findAllForAdmin(
    organizationId: string,
    query: QueryMessagesDto,
  ): Promise<{ data: Message[]; total: number; page: number; lastPage: number }> {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));

    const baseQb = this.messageRepository
      .createQueryBuilder('message')
      .where('message.organizationId = :organizationId', { organizationId });

    if (query.category) {
      baseQb.andWhere('message.category = :category', { category: query.category });
    }

    if (query.status) {
      baseQb.andWhere('message.status = :status', { status: query.status });
    }

    const total = await baseQb.getCount();

    const idsQb = this.messageRepository
      .createQueryBuilder('message')
      .select('message.id', 'id')
      .where('message.organizationId = :organizationId', { organizationId });

    if (query.category) {
      idsQb.andWhere('message.category = :category', { category: query.category });
    }

    if (query.status) {
      idsQb.andWhere('message.status = :status', { status: query.status });
    }

    idsQb
      .orderBy('message.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const rawIds = await idsQb.getRawMany<{ id: string }>();
    const ids = rawIds.map((row) => row.id);

    if (ids.length === 0) {
      return {
        data: [],
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      };
    }

    const data = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.replies', 'reply')
      .where('message.id IN (:...ids)', { ids })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('reply.createdAt', 'ASC')
      .getMany();

    return {
      data,
      total,
      page,
      lastPage: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findAllForResident(
    userId: string,
    organizationId: string,
    query: QueryMessagesDto,
  ): Promise<{ data: Message[]; total: number; page: number; lastPage: number }> {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));

    const baseQb = this.messageRepository
      .createQueryBuilder('message')
      .where('message.organizationId = :organizationId', { organizationId })
      .andWhere('message.senderUserId = :userId', { userId });

    if (query.category) {
      baseQb.andWhere('message.category = :category', { category: query.category });
    }

    if (query.status) {
      baseQb.andWhere('message.status = :status', { status: query.status });
    }

    const total = await baseQb.getCount();

    const idsQb = this.messageRepository
      .createQueryBuilder('message')
      .select('message.id', 'id')
      .where('message.organizationId = :organizationId', { organizationId })
      .andWhere('message.senderUserId = :userId', { userId });

    if (query.category) {
      idsQb.andWhere('message.category = :category', { category: query.category });
    }

    if (query.status) {
      idsQb.andWhere('message.status = :status', { status: query.status });
    }

    idsQb
      .orderBy('message.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const rawIds = await idsQb.getRawMany<{ id: string }>();
    const ids = rawIds.map((row) => row.id);

    if (ids.length === 0) {
      return {
        data: [],
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      };
    }

    const data = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.replies', 'reply')
      .where('message.id IN (:...ids)', { ids })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('reply.createdAt', 'ASC')
      .getMany();

    return {
      data,
      total,
      page,
      lastPage: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getUnreadState(organizationId: string): Promise<MessageUnreadState> {
    const unreadCount = await this.messageRepository.count({
      where: {
        organizationId,
        status: 'unread',
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'message_unread_count_fetched',
        organizationId,
        unreadCount,
      }),
    );

    return {
      unreadCount,
      hasUnread: unreadCount > 0,
    };
  }

  async markAsRead(messageId: string, organizationId: string): Promise<Message> {
    const message = await this.findById(messageId, organizationId);

    if (message.status === 'unread') {
      await this.messageRepository.update(message.id, {
        status: 'read',
        readAt: new Date(),
      });
    }

    return this.findById(message.id, organizationId);
  }

  async deleteAsAdmin(messageId: string, organizationId: string): Promise<{ success: true }> {
    const message = await this.findById(messageId, organizationId);
    await this.messageRepository.delete({ id: message.id, organizationId });
    return { success: true };
  }

  async ingestInboundEmailReply(
    data: IngestInboundEmailReplyDto,
    providedSecret?: string,
  ): Promise<{ created: boolean; reason: string | null; replyId: string | null }> {
    const expectedSecret = (this.configService.get<string>('CONTACT_EMAIL_INBOUND_SECRET') || '').trim();
    if (!expectedSecret || !providedSecret || providedSecret.trim() !== expectedSecret) {
      throw new ForbiddenException('Invalid inbound email secret');
    }

    const normalizedFrom = data.fromEmail.trim().toLowerCase();
    const resolvedThread = await this.resolveInboundThread(data);
    if (!resolvedThread) {
      return { created: false, reason: 'thread_not_found', replyId: null };
    }
    if (resolvedThread === 'invalid_reply_token') {
      return { created: false, reason: 'invalid_reply_token', replyId: null };
    }

    const message = await this.messageRepository.findOne({
      where: {
        id: resolvedThread.messageId,
        organizationId: resolvedThread.organizationId,
      },
    });

    if (!message) {
      return { created: false, reason: 'thread_not_found', replyId: null };
    }

    const normalizedMessageSender = (message.senderEmail || '').trim().toLowerCase();
    if (
      resolvedThread.expectedSenderEmail
      && normalizedMessageSender
      && resolvedThread.expectedSenderEmail !== normalizedMessageSender
    ) {
      return { created: false, reason: 'invalid_reply_token', replyId: null };
    }

    const expectedSenderEmail = resolvedThread.expectedSenderEmail || normalizedMessageSender;
    if (!expectedSenderEmail || normalizedFrom !== expectedSenderEmail) {
      return { created: false, reason: 'sender_mismatch', replyId: null };
    }

    const externalMessageId = data.externalMessageId?.trim() || null;
    if (externalMessageId) {
      const existing = await this.messageReplyRepository.findOne({
        where: {
          messageId: message.id,
          externalMessageId,
        },
      });
      if (existing) {
        return { created: false, reason: 'duplicate_external_message', replyId: existing.id };
      }
    }

    const inboundReply = this.messageReplyRepository.create({
      messageId: message.id,
      authorUserId: message.senderUserId,
      authorName: message.senderName,
      originRole: 'resident',
      originChannel: 'email_inbound',
      content: data.content.trim(),
      sendViaEmail: true,
      emailDeliveryStatus: 'pending',
      externalMessageId,
    });

    let savedReply: MessageReply;
    try {
      savedReply = await this.messageReplyRepository.save(inboundReply);
    } catch (error) {
      const duplicateExternalId = Boolean(
        externalMessageId
        && typeof error === 'object'
        && error
        && 'code' in error
        && (error as { code?: string }).code === '23505',
      );

      if (duplicateExternalId) {
        const dedupeExternalId = externalMessageId as string;
        const existing = await this.messageReplyRepository.findOne({
          where: {
            messageId: message.id,
            externalMessageId: dedupeExternalId,
          },
        });
        return {
          created: false,
          reason: 'duplicate_external_message',
          replyId: existing?.id || null,
        };
      }

      throw error;
    }
    const resolvedEmailStatus = await this.sendAdminResidentReplyEmail(message, savedReply);
    const updatedReply = await this.messageReplyRepository.save({
      ...savedReply,
      emailDeliveryStatus: resolvedEmailStatus.status,
      emailProviderMessageId: resolvedEmailStatus.providerMessageId,
      emailSentAt: resolvedEmailStatus.status === 'sent' ? new Date() : null,
      emailLastError: resolvedEmailStatus.errorMessage,
    });

    await this.messageRepository.update(message.id, {
      status: 'unread',
      readAt: null,
    });

    return { created: true, reason: null, replyId: updatedReply.id };
  }

  private async sendAdminResidentReplyEmail(message: Message, reply: MessageReply): Promise<{
    status: MessageEmailDeliveryStatus;
    providerMessageId: string | null;
    errorMessage: string | null;
  }> {
    const config = await this.contactEmailSettingsService.resolveDeliveryConfig(message.organizationId!, message.senderEmail);
    if (!config.shouldSend) {
      const reason = config.validationErrors.length
        ? `${config.reason}: ${config.validationErrors.join('; ')}`
        : config.reason;
      return {
        status: 'skipped',
        providerMessageId: null,
        errorMessage: this.trimError(reason),
      };
    }

    const adminThreadRoot = message.adminEmailProviderMessageId || null;
    const adminThreadLatest = await this.resolveLatestAdminNotificationMessageId(message.id);

    const emailResult = await this.emailService.send({
      to: config.recipients,
      subject: `[Contato][Resposta Morador] ${message.subject}`,
      text: this.composeAdminResidentReplyEmail(message, reply),
      from: config.from || undefined,
      replyTo: this.buildSignedReplyToAddress(message, config.replyTo),
      inReplyTo: adminThreadLatest || adminThreadRoot || undefined,
      references: this.composeReferences(adminThreadRoot, adminThreadLatest),
      headers: {
        'X-GrillRent-Message-Id': message.id,
        'X-GrillRent-Organization-Id': message.organizationId || '',
        'X-GrillRent-Reply-Id': reply.id,
      },
      smtp: config.smtp,
    });

    return {
      status: emailResult.status,
      providerMessageId: emailResult.providerMessageId,
      errorMessage: emailResult.errorMessage,
    };
  }

  private async dispatchAdminContactEmail(message: Message): Promise<{
    status: MessageEmailDeliveryStatus;
    providerMessageId: string | null;
    errorMessage: string | null;
    deliveryMode: string;
    reason: string | null;
  }> {
    try {
      const config = await this.contactEmailSettingsService.resolveDeliveryConfig(message.organizationId!, message.senderEmail);

      if (!config.shouldSend) {
        const reason = config.validationErrors.length
          ? `${config.reason}: ${config.validationErrors.join('; ')}`
          : config.reason;
        return {
          status: 'skipped',
          providerMessageId: null,
          errorMessage: this.trimError(reason),
          deliveryMode: config.deliveryMode,
          reason,
        };
      }

      const emailResult = await this.emailService.send({
        to: config.recipients,
        from: config.from || undefined,
        subject: `[Contato] ${this.categoryLabel(message.category)} - ${message.subject}`,
        replyTo: this.buildSignedReplyToAddress(message, config.replyTo),
        text: this.composeAdminMessageEmail(message),
        attachments: this.buildContactEmailAttachments(message),
        headers: {
          'X-GrillRent-Message-Id': message.id,
          'X-GrillRent-Organization-Id': message.organizationId || '',
          'X-GrillRent-Sender-User-Id': message.senderUserId,
        },
        smtp: config.smtp,
      });

      return {
        status: emailResult.status,
        providerMessageId: emailResult.providerMessageId,
        errorMessage: emailResult.errorMessage,
        deliveryMode: config.deliveryMode,
        reason: null,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown contact email delivery error';
      this.logger.error(
        JSON.stringify({
          event: 'contact_message_delivery_exception',
          messageId: message.id,
          organizationId: message.organizationId,
          reason,
        }),
      );
      return {
        status: 'failed',
        providerMessageId: null,
        errorMessage: this.trimError(reason),
        deliveryMode: 'in_app_and_email',
        reason,
      };
    }
  }

  private async resolveInboundThread(
    data: IngestInboundEmailReplyDto,
  ): Promise<ResolvedInboundThread | 'invalid_reply_token' | null> {
    const threadMessageIds = this.normalizeProviderMessageIds(data.threadMessageIds || []);
    if (threadMessageIds.length) {
      const headerMatch = await this.resolveMessageThreadByProviderIds(threadMessageIds);
      if (headerMatch) {
        return {
          ...headerMatch,
          resolutionMethod: 'header',
        };
      }
    }

    const hasDirectPayload = Boolean(data.organizationId && data.messageId);
    const replyTokenResult = await this.resolveThreadByReplyToken(data);
    if (replyTokenResult === 'invalid_reply_token') {
      if (!hasDirectPayload) {
        return 'invalid_reply_token';
      }
    } else if (replyTokenResult) {
      return replyTokenResult;
    }

    if (hasDirectPayload && data.organizationId && data.messageId) {
      return {
        organizationId: data.organizationId,
        messageId: data.messageId,
        expectedSenderEmail: null,
        resolutionMethod: 'direct_payload',
      };
    }

    return null;
  }

  private async resolveThreadByReplyToken(
    data: IngestInboundEmailReplyDto,
  ): Promise<ResolvedInboundThread | 'invalid_reply_token' | null> {
    const tokenCandidates = this.collectReplyTokenCandidates(data);
    if (!tokenCandidates.length) {
      return null;
    }

    let sawInvalidToken = false;
    for (const token of tokenCandidates) {
      const decoded = this.emailReplyTokenService.verifyReplyToken(token);
      if (!decoded.valid) {
        sawInvalidToken = true;
        continue;
      }

      if (decoded.payload.organizationId && decoded.payload.senderEmail) {
        return {
          messageId: decoded.payload.messageId,
          organizationId: decoded.payload.organizationId,
          expectedSenderEmail: decoded.payload.senderEmail,
          resolutionMethod: 'reply_token',
        };
      }

      const message = await this.messageRepository.findOne({
        where: { id: decoded.payload.messageId },
      });
      if (!message?.organizationId || !message.senderEmail) {
        continue;
      }

      const verified = this.emailReplyTokenService.verifyCompactTokenAgainstContext(token, {
        organizationId: message.organizationId,
        senderEmail: message.senderEmail,
      });
      if (!verified.valid) {
        sawInvalidToken = true;
        continue;
      }

      return {
        messageId: message.id,
        organizationId: message.organizationId,
        expectedSenderEmail: message.senderEmail.trim().toLowerCase(),
        resolutionMethod: 'reply_token',
      };
    }

    return sawInvalidToken ? 'invalid_reply_token' : null;
  }

  private collectReplyTokenCandidates(data: IngestInboundEmailReplyDto): string[] {
    const allRecipients = [
      ...(data.toRecipients || []),
      ...(data.deliveredToRecipients || []),
      ...(data.xOriginalToRecipients || []),
    ];

    const extractedTokens = allRecipients
      .map((recipient) => this.emailReplyTokenService.extractTokenFromReplyAddress(recipient))
      .filter((value): value is string => Boolean(value && value.trim()));

    return Array.from(new Set(extractedTokens));
  }

  private async resolveMessageThreadByProviderIds(providerIds: string[]): Promise<ResolvedInboundThread | null> {
    if (!providerIds.length) {
      return null;
    }

    const rows = await this.messageRepository.query(
      `
        with normalized_candidates as (
          select unnest($1::text[]) as candidate
        ),
        direct_match as (
          select
            m.id as "messageId",
            m."organizationId" as "organizationId",
            m."senderEmail" as "senderEmail",
            1 as priority
          from message m
          join normalized_candidates c
            on regexp_replace(lower(coalesce(m."adminEmailProviderMessageId", '')), '[<>]', '', 'g') = c.candidate
        ),
        reply_match as (
          select
            m.id as "messageId",
            m."organizationId" as "organizationId",
            m."senderEmail" as "senderEmail",
            2 as priority
          from message_reply mr
          join message m on m.id = mr."messageId"
          join normalized_candidates c
            on regexp_replace(lower(coalesce(mr."emailProviderMessageId", '')), '[<>]', '', 'g') = c.candidate
        )
        select "messageId", "organizationId", "senderEmail"
        from (
          select * from direct_match
          union all
          select * from reply_match
        ) matches
        order by priority asc
        limit 1
      `,
      [providerIds],
    );

    const match = rows?.[0];
    if (!match?.messageId || !match?.organizationId) {
      return null;
    }

    return {
      messageId: match.messageId,
      organizationId: match.organizationId,
      expectedSenderEmail: match.senderEmail ? String(match.senderEmail).trim().toLowerCase() : null,
      resolutionMethod: 'header',
    };
  }

  private normalizeProviderMessageIds(values: string[]): string[] {
    const normalized = values
      .map((value) => value.trim().toLowerCase().replace(/^<+|>+$/g, ''))
      .filter(Boolean);

    return Array.from(new Set(normalized));
  }

  private buildSignedReplyToAddress(
    message: Message,
    configuredReplyTo: string | null,
  ): string | undefined {
    const configuredReply = configuredReplyTo?.trim().toLowerCase() || null;
    const envMailbox = (this.configService.get<string>('CONTACT_EMAIL_REPLY_BASE_ADDRESS') || '').trim().toLowerCase();
    if (!envMailbox) {
      return configuredReply || undefined;
    }
    if (!message.organizationId || !message.senderEmail) {
      return configuredReply || undefined;
    }

    try {
      const token = this.emailReplyTokenService.generateReplyToken({
        messageId: message.id,
        organizationId: message.organizationId,
        senderEmail: message.senderEmail,
      });
      return this.emailReplyTokenService.buildReplyToAddress(envMailbox, token);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'reply_token_generation_failed',
          messageId: message.id,
          organizationId: message.organizationId || null,
          reason: error instanceof Error ? this.trimError(error.message) : 'unknown_error',
        }),
      );
      return configuredReply || undefined;
    }
  }

  private categoryLabel(category: Message['category']): string {
    if (category === 'complaint') return 'Reclamacao';
    if (category === 'question') return 'Duvida';
    return 'Sugestao';
  }

  private composeAdminMessageEmail(message: Message): string {
    const attachmentCount = message.attachments?.length || 0;

    return [
      'Nova mensagem enviada pelo contato do app.',
      '',
      `Assunto: ${message.subject}`,
      `Categoria: ${this.categoryLabel(message.category)}`,
      `Morador: ${message.senderName}`,
      `Email: ${message.senderEmail}`,
      `Apartamento/Bloco: ${message.senderApartment || '--'} / ${message.senderBlock ?? '--'}`,
      `Anexos: ${attachmentCount} imagem(ns)`,
      '',
      'Mensagem:',
      message.content,
    ].join('\n');
  }

  private buildContactEmailAttachments(message: Message): SendEmailAttachmentInput[] {
    const attachments = message.attachments || [];

    return attachments
      .map((dataUrl, index) => this.toEmailAttachment(dataUrl, index))
      .filter((attachment): attachment is SendEmailAttachmentInput => Boolean(attachment));
  }

  private toEmailAttachment(dataUrl: string, index: number): SendEmailAttachmentInput | null {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(dataUrl.trim());
    if (!match) return null;

    const contentType = match[1].toLowerCase();
    const base64Payload = match[2].replace(/\s/g, '');
    if (!base64Payload) return null;

    const extension = this.mimeToExtension(contentType);
    const safeIndex = index + 1;

    return {
      filename: `contato-anexo-${safeIndex}.${extension}`,
      content: base64Payload,
      contentType,
      encoding: 'base64',
    };
  }

  private mimeToExtension(mimeType: string): string {
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    if (mimeType === 'image/gif') return 'gif';
    if (mimeType === 'image/svg+xml') return 'svg';
    return 'bin';
  }

  private trimError(message: string): string {
    return message.length > 1024 ? message.slice(0, 1024) : message;
  }

  private composeAdminResidentReplyEmail(message: Message, reply: MessageReply): string {
    return [
      'Nova resposta do morador no fluxo de contato.',
      '',
      `Assunto original: ${message.subject}`,
      `Morador: ${message.senderName}`,
      `Email: ${message.senderEmail}`,
      `Origem: ${reply.originChannel === 'email_inbound' ? 'Resposta por email externo' : 'Resposta dentro do app'}`,
      '',
      'Resposta:',
      reply.content,
    ].join('\n');
  }

  private composeReferences(root: string | null, latest: string | null): string | undefined {
    const values = [root, latest].filter((value): value is string => Boolean(value && value.trim()));
    if (!values.length) return undefined;
    return Array.from(new Set(values)).join(' ');
  }

  private async resolveLatestAdminNotificationMessageId(messageId: string): Promise<string | null> {
    const latestReply = await this.messageReplyRepository
      .createQueryBuilder('reply')
      .where('reply.messageId = :messageId', { messageId })
      .andWhere('reply.originRole = :originRole', { originRole: 'resident' })
      .andWhere('reply.emailProviderMessageId IS NOT NULL')
      .orderBy('reply.createdAt', 'DESC')
      .getOne();

    return latestReply?.emailProviderMessageId || null;
  }

  private async findById(messageId: string, organizationId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, organizationId },
      relations: ['replies'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.replies?.length) {
      message.replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    return message;
  }

  isAdmin(role: string): boolean {
    return role === UserRole.ADMIN;
  }

  private isOnboardingRequired(user: User): boolean {
    const hasVerifiedActiveEmail = Boolean(user.email && user.emailVerifiedAt);
    return !hasVerifiedActiveEmail || Boolean(user.mustChangePassword);
  }
}
