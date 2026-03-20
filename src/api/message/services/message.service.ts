import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../user/entities/user.entity';
import { EmailService } from '../../../shared/email/email.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { CreateMessageReplyDto } from '../dto/create-message-reply.dto';
import { QueryMessagesDto } from '../dto/query-messages.dto';
import { Message, MessageEmailDeliveryStatus } from '../entities/message.entity';
import { MessageReply } from '../entities/message-reply.entity';
import { ContactEmailSettingsService } from './contact-email-settings.service';
import { IngestInboundEmailReplyDto } from '../dto/ingest-inbound-email-reply.dto';

interface MessageUnreadState {
  unreadCount: number;
  hasUnread: boolean;
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

  async replyAsAdmin(
    messageId: string,
    data: CreateMessageReplyDto,
    adminUserId: string,
    adminName: string,
    organizationId: string,
  ): Promise<MessageReply> {
    const message = await this.findById(messageId, organizationId);

    const sendViaEmail = Boolean(data.sendViaEmail) && Boolean(message.senderEmail);

    const reply = this.messageReplyRepository.create({
      messageId: message.id,
      authorUserId: adminUserId,
      authorName: adminName,
      originRole: 'admin',
      originChannel: 'in_app',
      content: data.content.trim(),
      sendViaEmail,
      emailDeliveryStatus: sendViaEmail ? 'pending' : 'not_requested',
    });

    const savedReply = await this.messageReplyRepository.save(reply);

    const resolvedEmailStatus = sendViaEmail
      ? await this.sendReplyEmail(message, savedReply)
      : ({
          status: 'not_requested',
          providerMessageId: null,
          errorMessage: null,
        } as const);

    const updatedReply = await this.messageReplyRepository.save({
      ...savedReply,
      emailDeliveryStatus: resolvedEmailStatus.status,
      emailProviderMessageId: resolvedEmailStatus.providerMessageId,
      emailSentAt: resolvedEmailStatus.status === 'sent' ? new Date() : null,
      emailLastError: resolvedEmailStatus.errorMessage,
    });

    await this.messageRepository.update(message.id, {
      status: 'replied',
      readAt: message.readAt || new Date(),
    });

    this.logger.log(
      JSON.stringify({
        event: 'contact_message_replied',
        messageId: message.id,
        replyId: updatedReply.id,
        organizationId,
        sentByEmail: sendViaEmail,
        emailStatus: updatedReply.emailDeliveryStatus,
      }),
    );

    return updatedReply;
  }

  async replyAsResident(
    messageId: string,
    data: CreateMessageReplyDto,
    residentUserId: string,
    residentName: string,
    organizationId: string,
  ): Promise<MessageReply> {
    const message = await this.findById(messageId, organizationId);
    if (message.senderUserId !== residentUserId) {
      throw new ForbiddenException('You do not have permission to reply this message');
    }

    const reply = this.messageReplyRepository.create({
      messageId: message.id,
      authorUserId: residentUserId,
      authorName: residentName,
      originRole: 'resident',
      originChannel: 'in_app',
      content: data.content.trim(),
      sendViaEmail: true,
      emailDeliveryStatus: 'pending',
    });

    const savedReply = await this.messageReplyRepository.save(reply);
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

    return updatedReply;
  }

  async ingestInboundEmailReply(
    data: IngestInboundEmailReplyDto,
    providedSecret?: string,
  ): Promise<{ created: boolean; reason: string | null; replyId: string | null }> {
    const expectedSecret = (this.configService.get<string>('CONTACT_EMAIL_INBOUND_SECRET') || '').trim();
    if (!expectedSecret || !providedSecret || providedSecret.trim() !== expectedSecret) {
      throw new ForbiddenException('Invalid inbound email secret');
    }

    const message = await this.messageRepository.findOne({
      where: {
        id: data.messageId,
        organizationId: data.organizationId,
      },
    });

    if (!message) {
      return { created: false, reason: 'message_not_found', replyId: null };
    }

    const normalizedFrom = data.fromEmail.trim().toLowerCase();
    const normalizedSender = (message.senderEmail || '').trim().toLowerCase();
    if (!normalizedSender || normalizedFrom !== normalizedSender) {
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

    const savedReply = await this.messageReplyRepository.save(inboundReply);
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

  private async sendReplyEmail(message: Message, reply: MessageReply): Promise<{
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

    const previousResidentThreadMessageId = await this.resolvePreviousResidentThreadMessageId(message.id, reply.id);
    const residentThreadRoot = previousResidentThreadMessageId;
    const residentThreadLatest = previousResidentThreadMessageId;

    const emailResult = await this.emailService.send({
      to: [message.senderEmail],
      subject: `[Resposta] ${message.subject}`,
      text: this.composeResidentReplyEmail(message, reply),
      from: config.from || undefined,
      replyTo: config.replyTo || undefined,
      inReplyTo: residentThreadLatest || undefined,
      references: this.composeReferences(residentThreadRoot, residentThreadLatest),
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
      replyTo: config.replyTo || undefined,
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
        replyTo: config.replyTo || undefined,
        text: this.composeAdminMessageEmail(message),
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

  private categoryLabel(category: Message['category']): string {
    if (category === 'complaint') return 'Reclamacao';
    if (category === 'question') return 'Duvida';
    return 'Sugestao';
  }

  private composeAdminMessageEmail(message: Message): string {
    return [
      'Nova mensagem enviada pelo contato do app.',
      '',
      `Assunto: ${message.subject}`,
      `Categoria: ${this.categoryLabel(message.category)}`,
      `Morador: ${message.senderName}`,
      `Email: ${message.senderEmail}`,
      `Apartamento/Bloco: ${message.senderApartment || '--'} / ${message.senderBlock ?? '--'}`,
      '',
      'Mensagem:',
      message.content,
    ].join('\n');
  }

  private trimError(message: string): string {
    return message.length > 1024 ? message.slice(0, 1024) : message;
  }

  private composeResidentReplyEmail(message: Message, reply: MessageReply): string {
    return [
      `Ola, ${message.senderName}.`,
      '',
      `Sua mensagem sobre "${message.subject}" recebeu uma resposta da administracao:`,
      '',
      reply.content,
      '',
      'Obrigado.',
    ].join('\n');
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

  private async resolvePreviousResidentThreadMessageId(
    messageId: string,
    currentReplyId: string,
  ): Promise<string | null> {
    const previousReply = await this.messageReplyRepository
      .createQueryBuilder('reply')
      .where('reply.messageId = :messageId', { messageId })
      .andWhere('reply.id != :currentReplyId', { currentReplyId })
      .andWhere('reply.originRole = :originRole', { originRole: 'admin' })
      .andWhere('reply.emailProviderMessageId IS NOT NULL')
      .orderBy('reply.createdAt', 'DESC')
      .getOne();

    return previousReply?.emailProviderMessageId || null;
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
