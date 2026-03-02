import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notice } from '../entities/notice.entity';

@Injectable()
export class NoticeService {
  constructor(
    @InjectRepository(Notice)
    private readonly noticeRepository: Repository<Notice>,
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
}
