import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { Resource } from '../entities/resource.entity';

@Controller('resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Post()
  async create(@Body() createResourceDto: Partial<Resource>) {
    return this.resourceService.create(createResourceDto);
  }

  @Get()
  async findAll() {
    return this.resourceService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.resourceService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() updateResourceDto: Partial<Resource>) {
    return this.resourceService.update(id, updateResourceDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: number) {
    return this.resourceService.remove(id);
  }
}
