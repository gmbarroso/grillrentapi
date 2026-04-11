import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import {
  OnboardingStatusQueryDto,
  OnboardingStatusQuerySchema,
  TestWhatsappConnectionDto,
  TestWhatsappConnectionSchema,
  UpdateWhatsappSettingsDto,
  UpdateWhatsappSettingsSchema,
  UpsertWhatsappGroupBindingDto,
  UpsertWhatsappGroupBindingSchema,
} from '../dto/whatsapp-settings.dto';
import { WhatsappSettingsService } from '../services/whatsapp-settings.service';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string; organizationId: string };
}

@Controller('whatsapp/settings')
export class WhatsappSettingsController {
  constructor(private readonly whatsappSettingsService: WhatsappSettingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getSettings(@Req() req: AuthenticatedRequest) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.getSettings(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bootstrap-legacy')
  async bootstrapFromLegacy(@Req() req: AuthenticatedRequest) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.bootstrapFromLegacyEnv(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  async updateSettings(
    @Req() req: AuthenticatedRequest,
    @Body(new JoiValidationPipe(UpdateWhatsappSettingsSchema)) data: UpdateWhatsappSettingsDto,
  ) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.updateSettings(req.user.organizationId, data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('test-connection')
  async testConnection(
    @Req() req: AuthenticatedRequest,
    @Body(new JoiValidationPipe(TestWhatsappConnectionSchema)) data: TestWhatsappConnectionDto,
  ) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.testConnection(req.user.organizationId, data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/start')
  async startOnboarding(@Req() req: AuthenticatedRequest) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.startOnboarding(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('onboarding/status')
  async getOnboardingStatus(
    @Req() req: AuthenticatedRequest,
    @Query(new JoiValidationPipe(OnboardingStatusQuerySchema)) query: OnboardingStatusQueryDto,
  ) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.getOnboardingStatus(req.user.organizationId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/refresh-qr')
  async refreshOnboardingQr(@Req() req: AuthenticatedRequest) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.refreshOnboardingQr(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/disconnect')
  async disconnectOnboarding(@Req() req: AuthenticatedRequest) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.disconnectOnboarding(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('groups')
  async fetchGroups(@Req() req: AuthenticatedRequest) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.fetchGroups(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bindings')
  async fetchBindings(@Req() req: AuthenticatedRequest) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.getGroupBindings(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('bindings/:feature')
  async upsertBinding(
    @Req() req: AuthenticatedRequest,
    @Param('feature') feature: string,
    @Body(new JoiValidationPipe(UpsertWhatsappGroupBindingSchema)) data: UpsertWhatsappGroupBindingDto,
  ) {
    this.ensureAdmin(req);
    return this.whatsappSettingsService.upsertGroupBinding(req.user.organizationId, feature, data);
  }

  private ensureAdmin(req: AuthenticatedRequest): void {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to manage WhatsApp settings');
    }
  }
}
