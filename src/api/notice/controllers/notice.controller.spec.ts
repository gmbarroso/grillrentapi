import { Test, TestingModule } from '@nestjs/testing';
import { NoticeController } from './notice.controller';
import { NoticeService } from '../services/notice.service';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';
import { ForbiddenException } from '@nestjs/common';

describe('NoticeController', () => {
  let controller: NoticeController;
  let service: jest.Mocked<NoticeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NoticeController],
      providers: [
        {
          provide: NoticeService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            getUnreadCount: jest.fn(),
            markAllAsSeen: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NoticeController>(NoticeController);
    service = module.get(NoticeService) as jest.Mocked<NoticeService>;
  });

  it('returns unread count for authenticated user', async () => {
    service.getUnreadCount.mockResolvedValue({ unreadCount: 3, lastSeenNoticesAt: null });

    await expect(
      controller.getUnreadCount({ user: { id: 'user-1', organizationId: 'org-1' } } as any),
    ).resolves.toEqual({ unreadCount: 3, lastSeenNoticesAt: null });
    expect(service.getUnreadCount).toHaveBeenCalledWith('user-1', 'org-1');
  });

  it('marks notices as seen for authenticated user', async () => {
    service.markAllAsSeen.mockResolvedValue({
      markedAsSeenAt: '2026-03-09T11:00:00.000Z',
      previousLastSeenNoticesAt: null,
    });

    await expect(
      controller.markAsSeen({ user: { id: 'user-1', organizationId: 'org-1' } } as any),
    ).resolves.toEqual({
      markedAsSeenAt: '2026-03-09T11:00:00.000Z',
      previousLastSeenNoticesAt: null,
    });
    expect(service.markAllAsSeen).toHaveBeenCalledWith('user-1', 'org-1');
  });

  it('blocks non-admin create operation', async () => {
    await expect(
      controller.create({ title: 'x' } as any, {
        user: { role: UserRole.RESIDENT, organizationId: 'org-1' },
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });
});
