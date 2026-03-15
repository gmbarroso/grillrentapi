import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { UserRole } from '../../user/entities/user.entity';
import { CreateMessageDto, CreateMessageSchema } from '../dto/create-message.dto';
import { CreateMessageReplyDto, CreateMessageReplySchema } from '../dto/create-message-reply.dto';
import { QueryMessagesDto, QueryMessagesSchema } from '../dto/query-messages.dto';
import { Message } from '../entities/message.entity';
import { MessageReply } from '../entities/message-reply.entity';
import { MessageService } from '../services/message.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    name: string;
    role: string;
    organizationId: string;
  };
}

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @UseGuards(JwtAuthGuard)
  @Post('contact')
  async createFromContact(
    @Body(new JoiValidationPipe(CreateMessageSchema)) data: CreateMessageDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Message> {
    return this.messageService.createFromContact(data, req.user.id, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin')
  async findAllForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query(new JoiValidationPipe(QueryMessagesSchema)) query: QueryMessagesDto,
  ): Promise<{ data: Message[]; total: number; page: number; lastPage: number }> {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to access admin messages');
    }

    return this.messageService.findAllForAdmin(req.user.organizationId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  async getUnreadCount(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ unreadCount: number; hasUnread: boolean }> {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to access admin messages');
    }

    return this.messageService.getUnreadState(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/mark-read')
  async markAsRead(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Message> {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to update messages');
    }

    return this.messageService.markAsRead(id, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/replies')
  async replyAsAdmin(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(CreateMessageReplySchema)) data: CreateMessageReplyDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<MessageReply> {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to reply messages');
    }

    return this.messageService.replyAsAdmin(id, data, req.user.id, req.user.name, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteAsAdmin(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true }> {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to delete messages');
    }

    return this.messageService.deleteAsAdmin(id, req.user.organizationId);
  }
}
