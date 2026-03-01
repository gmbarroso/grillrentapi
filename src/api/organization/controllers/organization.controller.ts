import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { CreateOrganizationDto, CreateOrganizationSchema } from '../dto/create-organization.dto';
import { OrganizationService } from '../services/organization.service';

@Controller('organizations')
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
