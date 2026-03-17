import { Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { UserRole } from '../../user/entities/user.entity';
import {
  UpdateContactEmailSettingsDto,
  UpdateContactEmailSettingsSchema,
} from '../dto/contact-email-settings.dto';
import { ContactEmailSettingsService } from '../services/contact-email-settings.service';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string; organizationId: string };
}

@Controller('messages/settings/contact-email')
export class ContactEmailSettingsController {
  constructor(private readonly contactEmailSettingsService: ContactEmailSettingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getSettings(@Req() req: AuthenticatedRequest) {
    this.ensureAdmin(req);
    return this.contactEmailSettingsService.getSettings(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  async updateSettings(
    @Req() req: AuthenticatedRequest,
    @Body(new JoiValidationPipe(UpdateContactEmailSettingsSchema)) data: UpdateContactEmailSettingsDto,
  ) {
    this.ensureAdmin(req);
    return this.contactEmailSettingsService.updateSettings(req.user.organizationId, data);
  }

  private ensureAdmin(req: AuthenticatedRequest): void {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to manage contact email settings');
    }
  }
}
