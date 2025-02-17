import { Controller, Post, Body, Logger, Get, Param, Put, Delete } from '@nestjs/common';
import { ResourceService } from '../services/resource.service';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { UpdateResourceDto } from '../dto/update-resource.dto';

@Controller('resources')
export class ResourceController {
  private readonly logger = new Logger(ResourceController.name);

  constructor(private readonly resourceService: ResourceService) {}

  @Post()
  async create(@Body() createResourceDto: CreateResourceDto) {
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
    this.logger.log(`Fetching resource ID: ${id}`);
    return this.resourceService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateResourceDto: UpdateResourceDto) {
    this.logger.log(`Updating resource ID: ${id}`);
    return this.resourceService.update(id, updateResourceDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.log(`Removing resource ID: ${id}`);
    return this.resourceService.remove(id);
  }
}
