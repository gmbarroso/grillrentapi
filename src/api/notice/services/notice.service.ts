import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Notice } from '../entities/notice.entity';
import { NoticeReadState } from '../entities/notice-read-state.entity';

@Injectable()
export class NoticeService {
  private readonly logger = new Logger(NoticeService.name);

  constructor(
    @InjectRepository(Notice)
    private readonly noticeRepository: Repository<Notice>,
    @InjectRepository(NoticeReadState)
    private readonly noticeReadStateRepository: Repository<NoticeReadState>,
  ) {}

  async create(data: Partial<Notice>, organizationId: string): Promise<Notice> {
    const notice = this.noticeRepository.create({ ...data, organizationId });
    return this.noticeRepository.save(notice);
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

  async update(id: string, data: Partial<Notice>, organizationId: string): Promise<Notice> {
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
  ): Promise<{ unreadCount: number; lastSeenNoticesAt: string | null }> {
    const readState = await this.noticeReadStateRepository.findOne({
      where: { userId, organizationId },
    });

    const lastSeenNoticesAt = readState?.lastSeenNoticesAt ?? null;
    const unreadCount = await this.noticeRepository.count({
      where: {
        organizationId,
        ...(lastSeenNoticesAt ? { createdAt: MoreThan(lastSeenNoticesAt) } : {}),
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'notice_unread_count_fetched',
        organizationId,
        unreadCount,
        hasReadState: Boolean(readState),
      }),
    );

    return {
      unreadCount,
      lastSeenNoticesAt: lastSeenNoticesAt ? lastSeenNoticesAt.toISOString() : null,
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
}
