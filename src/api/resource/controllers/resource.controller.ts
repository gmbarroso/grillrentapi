import { Controller, Post, Get, Body, Logger, Param, Put, Delete } from '@nestjs/common';
import { ResourceService } from '../services/resource.service';
import { CreateResourceDto, CreateResourceSchema } from '../dto/create-resource.dto';
import { UpdateResourceDto, UpdateResourceSchema } from '../dto/update-resource.dto';
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

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.log(`Fetching resource with id: ${id}`);
    return this.resourceService.findOne(+id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body(new JoiValidationPipe(UpdateResourceSchema)) updateResourceDto: UpdateResourceDto) {
    this.logger.log(`Updating resource with id: ${id}`);
    return this.resourceService.update(+id, updateResourceDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.log(`Removing resource with id: ${id}`);
    return this.resourceService.remove(+id);
  }
}
