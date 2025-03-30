import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { NoticeService } from '../services/notice.service';
import { Notice } from '../entities/notice.entity';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('notices')
export class NoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() data: Partial<Notice>, @Req() req: AuthenticatedRequest): Promise<Notice> {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('You do not have permission to create notices');
    }
    return this.noticeService.create(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<{ data: Notice[]; total: number }> {
    return this.noticeService.findAll(page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<Notice>, @Req() req: AuthenticatedRequest): Promise<Notice> {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('You do not have permission to update notices');
    }
    return this.noticeService.update(id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('You do not have permission to delete notices');
    }
    await this.noticeService.delete(id);
    return { message: 'Notice deleted successfully' };
  }
}
