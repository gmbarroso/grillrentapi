import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../user/entities/user.entity';
import { EmailService, type SendEmailAttachmentInput } from '../../../shared/email/email.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { QueryMessagesDto } from '../dto/query-messages.dto';
import { Message, MessageEmailDeliveryStatus } from '../entities/message.entity';
import { ContactEmailSettingsService } from './contact-email-settings.service';

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly contactEmailSettingsService: ContactEmailSettingsService,
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
        attachments: this.buildContactEmailAttachments(message),
        headers: {
          'X-GrillRent-Message-Id': message.id,
          'X-GrillRent-Organization-Id': message.organizationId || '',
          'X-GrillRent-Sender-User-Id': message.senderUserId,
        },
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
    if (category === 'complaint') return 'Reclamação';
    if (category === 'question') return 'Dúvida';
    return 'Sugestão';
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

  private composeReferences(root: string | null, latest: string | null): string | undefined {
    const values = [root, latest].filter((value): value is string => Boolean(value && value.trim()));
    if (!values.length) return undefined;
    return Array.from(new Set(values)).join(' ');
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
    const hasPendingEmailVerification = Boolean(user.pendingEmail);
    return hasPendingEmailVerification || !hasVerifiedActiveEmail || Boolean(user.mustChangePassword);
  }
}
