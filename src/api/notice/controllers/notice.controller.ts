import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { NoticeService } from '../services/notice.service';
import { Notice } from '../entities/notice.entity';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string; organizationId: string };
}

@Controller('notices')
export class NoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() data: Partial<Notice>, @Req() req: AuthenticatedRequest): Promise<Notice> {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to create notices');
    }

    return this.noticeService.create(data, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<{ data: Notice[]; total: number }> {
    return this.noticeService.findAll(req.user.organizationId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  async getUnreadCount(@Req() req: AuthenticatedRequest): Promise<{ unreadCount: number; lastSeenNoticesAt: string | null }> {
    return this.noticeService.getUnreadCount(req.user.id, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mark-seen')
  async markAsSeen(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ markedAsSeenAt: string; previousLastSeenNoticesAt: string | null }> {
    return this.noticeService.markAllAsSeen(req.user.id, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<Notice>, @Req() req: AuthenticatedRequest): Promise<Notice> {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to update notices');
    }

    return this.noticeService.update(id, data, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to delete notices');
    }

    await this.noticeService.delete(id, req.user.organizationId);
    return { message: 'Notice deleted successfully' };
  }
}
