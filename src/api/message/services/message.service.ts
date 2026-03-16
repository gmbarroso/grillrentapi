import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

    return this.findById(updated.id, organizationId);
  }

  async findAllForAdmin(
    organizationId: string,
    query: QueryMessagesDto,
  ): Promise<{ data: Message[]; total: number; page: number; lastPage: number }> {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.replies', 'reply')
      .where('message.organizationId = :organizationId', { organizationId })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('reply.createdAt', 'ASC');

    if (query.category) {
      qb.andWhere('message.category = :category', { category: query.category });
    }

    if (query.status) {
      qb.andWhere('message.status = :status', { status: query.status });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

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

  private async sendReplyEmail(message: Message, reply: MessageReply): Promise<{
    status: MessageEmailDeliveryStatus;
    providerMessageId: string | null;
    errorMessage: string | null;
  }> {
    const emailResult = await this.emailService.send({
      to: [message.senderEmail],
      subject: `[Resposta] ${message.subject}`,
      text: this.composeResidentReplyEmail(message, reply),
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
