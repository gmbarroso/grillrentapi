import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageService } from './message.service';
import { Message } from '../entities/message.entity';
import { MessageReply } from '../entities/message-reply.entity';
import { User } from '../../user/entities/user.entity';
import { EmailService } from '../../../shared/email/email.service';
import { ContactEmailSettingsService } from './contact-email-settings.service';

describe('MessageService', () => {
  let service: MessageService;
  let messageRepository: jest.Mocked<Repository<Message>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let emailService: jest.Mocked<EmailService>;
  let contactEmailSettingsService: jest.Mocked<ContactEmailSettingsService>;

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
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    messageRepository = module.get(getRepositoryToken(Message));
    userRepository = module.get(getRepositoryToken(User));
    emailService = module.get(EmailService);
    contactEmailSettingsService = module.get(ContactEmailSettingsService);
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
});
