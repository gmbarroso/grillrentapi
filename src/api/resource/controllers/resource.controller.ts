import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { ResourceService } from '../services/resource.service';
import { CreateResourceDto, CreateResourceSchema } from '../dto/create-resource.dto';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';

@Controller('resources')
export class ResourceController {
  private readonly logger = new Logger(ResourceController.name);

  constructor(private readonly resourceService: ResourceService) {}

  @Post()
  async create(@Body(new JoiValidationPipe(CreateResourceSchema)) createResourceDto: CreateResourceDto) {
    this.logger.log(`Creating resource: ${createResourceDto.name}`);
    return this.resourceService.create(createResourceDto);
  }

  @Get()
  async findAll() {
    this.logger.log('Fetching all resources');
    return this.resourceService.findAll();
  }
}
