import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';
import { MessageController } from './message.controller';
import { MessageService } from '../services/message.service';

describe('MessageController', () => {
  let controller: MessageController;
  let service: jest.Mocked<MessageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageController],
      providers: [
        {
          provide: MessageService,
          useValue: {
            createFromContact: jest.fn(),
            findAllForAdmin: jest.fn(),
            findAllForResident: jest.fn(),
            getUnreadState: jest.fn(),
            markAsRead: jest.fn(),
            ingestInboundEmailReply: jest.fn(),
            deleteAsAdmin: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessageController>(MessageController);
    service = module.get(MessageService) as jest.Mocked<MessageService>;
  });

  it('allows authenticated user to create contact message', async () => {
    service.createFromContact.mockResolvedValue({ id: 'message-1' } as any);

    await expect(
      controller.createFromContact(
        { subject: 'Teste', category: 'question', content: 'Mensagem' } as any,
        {
          user: { id: 'user-1', organizationId: 'org-1' },
        } as any,
      ),
    ).resolves.toEqual({ id: 'message-1' });

    expect(service.createFromContact).toHaveBeenCalledWith(
      { subject: 'Teste', category: 'question', content: 'Mensagem' },
      'user-1',
      'org-1',
    );
  });

  it('blocks non-admin access to admin list', async () => {
    await expect(
      controller.findAllForAdmin(
        {
          user: { role: UserRole.RESIDENT, organizationId: 'org-1' },
        } as any,
        { page: 1, limit: 20 } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns unread count for admin', async () => {
    service.getUnreadState.mockResolvedValue({ unreadCount: 2, hasUnread: true });

    await expect(
      controller.getUnreadCount(
        {
          user: { role: UserRole.ADMIN, organizationId: 'org-1' },
        } as any,
      ),
    ).resolves.toEqual({ unreadCount: 2, hasUnread: true });

    expect(service.getUnreadState).toHaveBeenCalledWith('org-1');
  });

  it('returns resident messages for resident user', async () => {
    service.findAllForResident.mockResolvedValue({ data: [], total: 0, page: 1, lastPage: 1 } as any);

    await expect(
      controller.findAllForResident(
        {
          user: { id: 'resident-1', role: UserRole.RESIDENT, organizationId: 'org-1' },
        } as any,
        { page: 1, limit: 20 } as any,
      ),
    ).resolves.toEqual({ data: [], total: 0, page: 1, lastPage: 1 });

    expect(service.findAllForResident).toHaveBeenCalledWith('resident-1', 'org-1', { page: 1, limit: 20 });
  });

  it('blocks admin from resident messages endpoint', async () => {
    await expect(
      controller.findAllForResident(
        {
          user: { id: 'admin-1', role: UserRole.ADMIN, organizationId: 'org-1' },
        } as any,
        { page: 1, limit: 20 } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('forwards inbound email ingestion request', async () => {
    service.ingestInboundEmailReply.mockResolvedValue({ created: true, reason: null, replyId: 'reply-1' });

    await expect(
      controller.ingestInboundEmailReply(
        {
          organizationId: '9dd02335-74fa-487b-99f3-f3e6f9fba2af',
          messageId: '11111111-1111-4111-8111-111111111111',
          fromEmail: 'resident@example.com',
          content: 'Resposta',
        } as any,
        'secret-token',
      ),
    ).resolves.toEqual({ created: true, reason: null, replyId: 'reply-1' });

    expect(service.ingestInboundEmailReply).toHaveBeenCalledWith(
      expect.objectContaining({
        fromEmail: 'resident@example.com',
      }),
      'secret-token',
    );
  });

  it('allows admin to delete message', async () => {
    service.deleteAsAdmin.mockResolvedValue({ success: true });

    await expect(
      controller.deleteAsAdmin(
        'message-1',
        {
          user: { role: UserRole.ADMIN, organizationId: 'org-1' },
        } as any,
      ),
    ).resolves.toEqual({ success: true });

    expect(service.deleteAsAdmin).toHaveBeenCalledWith('message-1', 'org-1');
  });
});
