import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { CreateOrganizationDto, CreateOrganizationSchema } from '../dto/create-organization.dto';
import { OrganizationService } from '../services/organization.service';
import { InternalServiceAuthGuard } from '../../../shared/auth/guards/internal-service-auth.guard';

@Controller('organizations')
@UseGuards(InternalServiceAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  async create(@Body(new JoiValidationPipe(CreateOrganizationSchema)) createOrganizationDto: CreateOrganizationDto) {
    return this.organizationService.create(createOrganizationDto);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.organizationService.findBySlug(slug);
  }
}
