import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NoticeService } from './notice.service';
import { Notice } from '../entities/notice.entity';
import { NoticeReadState } from '../entities/notice-read-state.entity';

describe('NoticeService', () => {
  let service: NoticeService;
  let noticeRepository: jest.Mocked<Repository<Notice>>;
  let noticeReadStateRepository: jest.Mocked<Repository<NoticeReadState>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticeService,
        { provide: getRepositoryToken(Notice), useClass: Repository },
        { provide: getRepositoryToken(NoticeReadState), useClass: Repository },
      ],
    }).compile();

    service = module.get<NoticeService>(NoticeService);
    noticeRepository = module.get(getRepositoryToken(Notice));
    noticeReadStateRepository = module.get(getRepositoryToken(NoticeReadState));
  });

  it('returns all organization notices as unread when read state does not exist', async () => {
    jest.spyOn(noticeReadStateRepository, 'findOne').mockResolvedValue(null);
    jest.spyOn(noticeRepository, 'count').mockResolvedValue(4);

    await expect(service.getUnreadCount('user-1', 'org-1')).resolves.toEqual({
      unreadCount: 4,
      lastSeenNoticesAt: null,
    });

    expect(noticeRepository.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
    });
  });

  it('counts unread notices newer than lastSeenNoticesAt', async () => {
    const lastSeenNoticesAt = new Date('2026-03-01T10:00:00.000Z');

    jest.spyOn(noticeReadStateRepository, 'findOne').mockResolvedValue({
      id: 'state-1',
      userId: 'user-1',
      organizationId: 'org-1',
      lastSeenNoticesAt,
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      updatedAt: new Date('2026-03-01T10:00:00.000Z'),
    } as NoticeReadState);
    jest.spyOn(noticeRepository, 'count').mockResolvedValue(2);

    const result = await service.getUnreadCount('user-1', 'org-1');

    expect(result.unreadCount).toBe(2);
    expect(result.lastSeenNoticesAt).toBe(lastSeenNoticesAt.toISOString());
    expect(noticeRepository.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ organizationId: 'org-1' }),
    });
  });

  it('creates read state when marking seen for first time', async () => {
    jest.spyOn(noticeReadStateRepository, 'findOne').mockResolvedValue(null);
    jest.spyOn(noticeReadStateRepository, 'query').mockResolvedValue([
      { lastSeenNoticesAt: '2026-03-09T10:00:00.123Z' },
    ]);

    const result = await service.markAllAsSeen('user-1', 'org-1');

    expect(noticeReadStateRepository.query).toHaveBeenCalled();
    expect(result.previousLastSeenNoticesAt).toBeNull();
    expect(result.markedAsSeenAt).toBe('2026-03-09T10:00:00.123Z');
  });

  it('updates read state inside organization scope', async () => {
    const existing = {
      id: 'state-1',
      userId: 'user-1',
      organizationId: 'org-1',
      lastSeenNoticesAt: new Date('2026-03-02T10:00:00.000Z'),
      createdAt: new Date('2026-03-02T10:00:00.000Z'),
      updatedAt: new Date('2026-03-02T10:00:00.000Z'),
    } as NoticeReadState;

    jest.spyOn(noticeReadStateRepository, 'findOne').mockResolvedValue(existing);
    jest.spyOn(noticeReadStateRepository, 'query').mockResolvedValue([
      { lastSeenNoticesAt: '2026-03-09T11:00:00.789Z' },
    ]);

    const result = await service.markAllAsSeen('user-1', 'org-1');

    expect(noticeReadStateRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', organizationId: 'org-1' },
    });
    expect(result.previousLastSeenNoticesAt).toBe('2026-03-02T10:00:00.000Z');
    expect(result.markedAsSeenAt).toBe('2026-03-09T11:00:00.789Z');
  });
});
