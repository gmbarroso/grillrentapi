import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { CreateOrganizationDto, CreateOrganizationSchema } from '../dto/create-organization.dto';
import { UpdateOrganizationDto, UpdateOrganizationSchema } from '../dto/update-organization.dto';
import { OrganizationService } from '../services/organization.service';
import { InternalServiceAuthGuard } from '../../../shared/auth/guards/internal-service-auth.guard';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body(new JoiValidationPipe(CreateOrganizationSchema)) createOrganizationDto: CreateOrganizationDto,
    @Req() req: any,
  ) {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can create organizations');
    }
    return this.organizationService.create(createOrganizationDto);
  }

  @UseGuards(InternalServiceAuthGuard)
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.organizationService.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Get('current')
  async getCurrent(@Req() req: any) {
    return this.organizationService.findById(req.user.organizationId as string);
  }

  @UseGuards(JwtAuthGuard)
  @Put('current')
  async updateCurrent(
    @Req() req: any,
    @Body(new JoiValidationPipe(UpdateOrganizationSchema)) updateOrganizationDto: UpdateOrganizationDto,
  ) {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update organization identity');
    }

    return this.organizationService.updateById(req.user.organizationId as string, updateOrganizationDto);
  }
}
