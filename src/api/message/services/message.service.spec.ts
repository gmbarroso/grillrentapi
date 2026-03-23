import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageService } from './message.service';
import { Message } from '../entities/message.entity';
import { MessageReply } from '../entities/message-reply.entity';
import { User, UserRole } from '../../user/entities/user.entity';
import { EmailService } from '../../../shared/email/email.service';
import { ContactEmailSettingsService } from './contact-email-settings.service';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailReplyTokenService } from './email-reply-token.service';

describe('MessageService', () => {
  let service: MessageService;
  let messageRepository: jest.Mocked<Repository<Message>>;
  let messageReplyRepository: jest.Mocked<Repository<MessageReply>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let emailService: jest.Mocked<EmailService>;
  let contactEmailSettingsService: jest.Mocked<ContactEmailSettingsService>;
  let configService: jest.Mocked<ConfigService>;
  let emailReplyTokenService: EmailReplyTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: getRepositoryToken(Message), useClass: Repository },
        { provide: getRepositoryToken(MessageReply), useClass: Repository },
        { provide: getRepositoryToken(User), useClass: Repository },
        {
          provide: EmailService,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: ContactEmailSettingsService,
          useValue: {
            getSettings: jest.fn(),
            updateSettings: jest.fn(),
            resolveDeliveryConfig: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CONTACT_EMAIL_INBOUND_SECRET') return 'expected-secret';
              if (key === 'CONTACT_EMAIL_REPLY_TOKEN_SECRET') return 'token-secret';
              if (key === 'CONTACT_EMAIL_REPLY_TOKEN_TTL_HOURS') return '720';
              return undefined;
            }),
          },
        },
        EmailReplyTokenService,
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    messageRepository = module.get(getRepositoryToken(Message));
    messageReplyRepository = module.get(getRepositoryToken(MessageReply));
    userRepository = module.get(getRepositoryToken(User));
    emailService = module.get(EmailService);
    contactEmailSettingsService = module.get(ContactEmailSettingsService);
    configService = module.get(ConfigService);
    emailReplyTokenService = module.get(EmailReplyTokenService);
  });

  it('skips contact email when org mode is in_app_only', async () => {
    const persisted = {
      id: 'msg-1',
      subject: 'Assunto',
      category: 'question',
      content: 'Mensagem',
      senderName: 'Morador',
      senderEmail: 'morador@condo.com',
      senderApartment: '101',
      senderBlock: 1,
      organizationId: 'org-1',
      replies: [],
    } as unknown as Message;

    jest.spyOn(userRepository, 'findOne').mockResolvedValue({
      id: 'user-1',
      name: 'Morador',
      email: 'morador@condo.com',
      apartment: '101',
      block: 1,
      organizationId: 'org-1',
      role: UserRole.RESIDENT,
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      mustChangePassword: false,
    } as User);
    jest.spyOn(messageRepository, 'create').mockReturnValue(persisted);
    jest.spyOn(messageRepository, 'save').mockResolvedValue(persisted);
    jest.spyOn(messageRepository, 'update').mockResolvedValue({} as any);
    jest.spyOn(messageRepository, 'findOne').mockResolvedValue({
      ...persisted,
      adminEmailDeliveryStatus: 'skipped',
      adminEmailLastError: 'Delivery mode is in_app_only',
      replies: [],
    } as Message);
    contactEmailSettingsService.resolveDeliveryConfig.mockResolvedValue({
      shouldSend: false,
      deliveryMode: 'in_app_only',
      reason: 'Delivery mode is in_app_only',
      validationErrors: [],
    });

    await expect(
      service.createFromContact(
        { subject: 'Assunto', category: 'question', content: 'Mensagem' },
        'user-1',
        'org-1',
      ),
    ).resolves.toBeDefined();

    expect(emailService.send).not.toHaveBeenCalled();
    expect(messageRepository.update).toHaveBeenCalledWith(
      'msg-1',
      expect.objectContaining({
        adminEmailDeliveryStatus: 'skipped',
      }),
    );
  });

  it('keeps message creation working when email orchestration throws', async () => {
    const persisted = {
      id: 'msg-2',
      subject: 'Assunto',
      category: 'suggestion',
      content: 'Mensagem',
      senderName: 'Morador',
      senderEmail: 'morador@condo.com',
      organizationId: 'org-1',
      replies: [],
    } as unknown as Message;

    jest.spyOn(userRepository, 'findOne').mockResolvedValue({
      id: 'user-1',
      name: 'Morador',
      email: 'morador@condo.com',
      organizationId: 'org-1',
      role: UserRole.RESIDENT,
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      mustChangePassword: false,
    } as User);
    jest.spyOn(messageRepository, 'create').mockReturnValue(persisted);
    jest.spyOn(messageRepository, 'save').mockResolvedValue(persisted);
    jest.spyOn(messageRepository, 'update').mockResolvedValue({} as any);
    jest.spyOn(messageRepository, 'findOne').mockResolvedValue({
      ...persisted,
      adminEmailDeliveryStatus: 'failed',
      adminEmailLastError: 'settings repository unavailable',
      replies: [],
    } as Message);
    contactEmailSettingsService.resolveDeliveryConfig.mockRejectedValue(new Error('settings repository unavailable'));

    await expect(
      service.createFromContact(
        { subject: 'Assunto', category: 'suggestion', content: 'Mensagem' },
        'user-1',
        'org-1',
      ),
    ).resolves.toBeDefined();

    expect(messageRepository.update).toHaveBeenCalledWith(
      'msg-2',
      expect.objectContaining({
        adminEmailDeliveryStatus: 'failed',
        adminEmailLastError: 'settings repository unavailable',
      }),
    );
  });

  it('blocks contact creation for residents with pending onboarding', async () => {
    jest.spyOn(userRepository, 'findOne').mockResolvedValue({
      id: 'user-2',
      name: 'Resident',
      email: null,
      role: UserRole.RESIDENT,
      mustChangePassword: true,
      organizationId: 'org-1',
    } as User);

    await expect(
      service.createFromContact(
        { subject: 'Assunto', category: 'question', content: 'Mensagem' },
        'user-2',
        'org-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects inbound ingestion with invalid secret', async () => {
    configService.get.mockReturnValue('expected-secret' as never);

    await expect(
      service.ingestInboundEmailReply(
        {
          organizationId: 'org-1',
          messageId: 'msg-1',
          fromEmail: 'resident@example.com',
          content: 'reply',
        } as any,
        'wrong-secret',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns duplicate_external_message when external id already exists', async () => {
    configService.get.mockReturnValue('expected-secret' as never);
    jest.spyOn(messageRepository, 'findOne').mockResolvedValue({
      id: 'msg-1',
      organizationId: 'org-1',
      senderEmail: 'resident@example.com',
      senderUserId: 'resident-1',
      senderName: 'Resident',
      replies: [],
    } as any);
    jest.spyOn(messageReplyRepository, 'findOne').mockResolvedValue({
      id: 'reply-existing',
      messageId: 'msg-1',
      externalMessageId: 'ext-1',
    } as any);

    await expect(
      service.ingestInboundEmailReply(
        {
          organizationId: 'org-1',
          messageId: 'msg-1',
          fromEmail: 'resident@example.com',
          content: 'reply',
          externalMessageId: 'ext-1',
        } as any,
        'expected-secret',
      ),
    ).resolves.toEqual({
      created: false,
      reason: 'duplicate_external_message',
      replyId: 'reply-existing',
    });
  });

  it('resolves inbound thread by header message IDs', async () => {
    jest.spyOn(messageRepository, 'query').mockResolvedValue([
      {
        messageId: '11111111-1111-4111-8111-111111111111',
        organizationId: '22222222-2222-4222-8222-222222222222',
        senderEmail: 'resident@example.com',
      },
    ] as any);
    jest.spyOn(messageRepository, 'findOne').mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'resident@example.com',
      senderUserId: 'resident-1',
      senderName: 'Resident',
      replies: [],
    } as any);
    jest.spyOn(messageReplyRepository, 'findOne').mockResolvedValue(null as any);
    jest.spyOn(messageReplyRepository, 'create').mockImplementation((value) => value as any);
    jest.spyOn(messageReplyRepository, 'save')
      .mockResolvedValueOnce({ id: 'reply-1' } as any)
      .mockResolvedValueOnce({ id: 'reply-1' } as any);
    jest.spyOn(messageRepository, 'update').mockResolvedValue({} as any);
    contactEmailSettingsService.resolveDeliveryConfig.mockResolvedValue({
      shouldSend: false,
      deliveryMode: 'in_app_only',
      reason: 'Delivery mode is in_app_only',
      validationErrors: [],
    });

    await expect(
      service.ingestInboundEmailReply(
        {
          fromEmail: 'resident@example.com',
          content: 'reply',
          threadMessageIds: ['<ADMIN-ROOT@example.com>'],
        } as any,
        'expected-secret',
      ),
    ).resolves.toEqual({
      created: true,
      reason: null,
      replyId: 'reply-1',
    });
  });

  it('resolves inbound thread by signed plus-address token', async () => {
    const token = emailReplyTokenService.generateReplyToken({
      messageId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'resident@example.com',
    });
    const replyTo = emailReplyTokenService.buildReplyToAddress('faleconosco@example.com', token);

    jest.spyOn(messageRepository, 'findOne').mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'resident@example.com',
      senderUserId: 'resident-1',
      senderName: 'Resident',
      replies: [],
    } as any);
    jest.spyOn(messageReplyRepository, 'findOne').mockResolvedValue(null as any);
    jest.spyOn(messageReplyRepository, 'create').mockImplementation((value) => value as any);
    jest.spyOn(messageReplyRepository, 'save')
      .mockResolvedValueOnce({ id: 'reply-2' } as any)
      .mockResolvedValueOnce({ id: 'reply-2' } as any);
    jest.spyOn(messageRepository, 'update').mockResolvedValue({} as any);
    contactEmailSettingsService.resolveDeliveryConfig.mockResolvedValue({
      shouldSend: false,
      deliveryMode: 'in_app_only',
      reason: 'Delivery mode is in_app_only',
      validationErrors: [],
    });

    await expect(
      service.ingestInboundEmailReply(
        {
          fromEmail: 'resident@example.com',
          content: 'reply',
          toRecipients: [replyTo],
        } as any,
        'expected-secret',
      ),
    ).resolves.toEqual({
      created: true,
      reason: null,
      replyId: 'reply-2',
    });
  });

  it('returns invalid_reply_token when plus token is expired', async () => {
    const expiredToken = emailReplyTokenService.generateReplyToken({
      messageId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'resident@example.com',
      exp: Math.floor(Date.now() / 1000) - 30,
    });
    const replyTo = emailReplyTokenService.buildReplyToAddress('faleconosco@example.com', expiredToken);

    await expect(
      service.ingestInboundEmailReply(
        {
          fromEmail: 'resident@example.com',
          content: 'reply',
          deliveredToRecipients: [replyTo],
        } as any,
        'expected-secret',
      ),
    ).resolves.toEqual({
      created: false,
      reason: 'invalid_reply_token',
      replyId: null,
    });
  });

  it('falls back to direct payload when token is invalid but organizationId/messageId is provided', async () => {
    const expiredToken = emailReplyTokenService.generateReplyToken({
      messageId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'resident@example.com',
      exp: Math.floor(Date.now() / 1000) - 30,
    });
    const replyTo = emailReplyTokenService.buildReplyToAddress('faleconosco@example.com', expiredToken);

    jest.spyOn(messageRepository, 'findOne').mockResolvedValue({
      id: 'msg-fallback',
      organizationId: 'org-fallback',
      senderEmail: 'resident@example.com',
      senderUserId: 'resident-1',
      senderName: 'Resident',
      replies: [],
    } as any);
    jest.spyOn(messageReplyRepository, 'findOne').mockResolvedValue(null as any);
    jest.spyOn(messageReplyRepository, 'create').mockImplementation((value) => value as any);
    jest.spyOn(messageReplyRepository, 'save')
      .mockResolvedValueOnce({ id: 'reply-fallback' } as any)
      .mockResolvedValueOnce({ id: 'reply-fallback' } as any);
    jest.spyOn(messageRepository, 'update').mockResolvedValue({} as any);
    contactEmailSettingsService.resolveDeliveryConfig.mockResolvedValue({
      shouldSend: false,
      deliveryMode: 'in_app_only',
      reason: 'Delivery mode is in_app_only',
      validationErrors: [],
    });

    await expect(
      service.ingestInboundEmailReply(
        {
          organizationId: 'org-fallback',
          messageId: 'msg-fallback',
          fromEmail: 'resident@example.com',
          content: 'reply',
          toRecipients: [replyTo],
        } as any,
        'expected-secret',
      ),
    ).resolves.toEqual({
      created: true,
      reason: null,
      replyId: 'reply-fallback',
    });
  });

  it('returns sender_mismatch when reply sender does not match expected resident', async () => {
    jest.spyOn(messageRepository, 'query').mockResolvedValue([
      {
        messageId: '11111111-1111-4111-8111-111111111111',
        organizationId: '22222222-2222-4222-8222-222222222222',
        senderEmail: 'resident@example.com',
      },
    ] as any);
    jest.spyOn(messageRepository, 'findOne').mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'resident@example.com',
      senderUserId: 'resident-1',
      senderName: 'Resident',
      replies: [],
    } as any);

    await expect(
      service.ingestInboundEmailReply(
        {
          fromEmail: 'another-resident@example.com',
          content: 'reply',
          threadMessageIds: ['<admin-root@example.com>'],
        } as any,
        'expected-secret',
      ),
    ).resolves.toEqual({
      created: false,
      reason: 'sender_mismatch',
      replyId: null,
    });
  });

  it('handles duplicate key races atomically when saving inbound reply', async () => {
    jest.spyOn(messageRepository, 'findOne').mockResolvedValue({
      id: 'msg-atomic',
      organizationId: 'org-atomic',
      senderEmail: 'resident@example.com',
      senderUserId: 'resident-1',
      senderName: 'Resident',
      replies: [],
    } as any);
    jest.spyOn(messageReplyRepository, 'findOne')
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce({ id: 'reply-existing' } as any);
    jest.spyOn(messageReplyRepository, 'create').mockImplementation((value) => value as any);
    jest.spyOn(messageReplyRepository, 'save').mockRejectedValueOnce({ code: '23505' });

    await expect(
      service.ingestInboundEmailReply(
        {
          organizationId: 'org-atomic',
          messageId: 'msg-atomic',
          fromEmail: 'resident@example.com',
          content: 'reply',
          externalMessageId: 'ext-race-1',
        } as any,
        'expected-secret',
      ),
    ).resolves.toEqual({
      created: false,
      reason: 'duplicate_external_message',
      replyId: 'reply-existing',
    });
  });
});
