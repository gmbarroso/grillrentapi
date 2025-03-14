import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { NoticeService } from '../services/notice.service';
import { Notice } from '../entities/notice.entity';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { AuthService } from '../../../shared/auth/services/auth.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('notices')
export class NoticeController {
  constructor(
    private readonly noticeService: NoticeService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() data: Partial<Notice>, @Req() req: AuthenticatedRequest): Promise<Notice> {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const token = authorizationHeader.split(' ')[1];
    const isRevoked = await this.authService.isTokenRevoked(token);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }

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
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const token = authorizationHeader.split(' ')[1];
    const isRevoked = await this.authService.isTokenRevoked(token);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }

    if (req.user.role !== 'admin') {
      throw new ForbiddenException('You do not have permission to update notices');
    }

    return this.noticeService.update(id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const token = authorizationHeader.split(' ')[1];
    const isRevoked = await this.authService.isTokenRevoked(token);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }

    if (req.user.role !== 'admin') {
      throw new ForbiddenException('You do not have permission to delete notices');
    }

    await this.noticeService.delete(id);
    return { message: 'Notice deleted successfully' };
  }
}
