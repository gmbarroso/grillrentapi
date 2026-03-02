import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { CreateOrganizationDto, CreateOrganizationSchema } from '../dto/create-organization.dto';
import { OrganizationService } from '../services/organization.service';
import { InternalServiceAuthGuard } from '../../../shared/auth/guards/internal-service-auth.guard';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';

@Controller('organizations')
@UseGuards(InternalServiceAuthGuard)
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

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.organizationService.findBySlug(slug);
  }
}
