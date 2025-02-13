import { Controller, Get, Post, Body } from '@nestjs/common';
import { ResourceService } from '../services/resource.service';
import { CreateResourceDto, CreateResourceSchema } from '../dto/create-resource.dto';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';

@Controller('resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Get()
  async findAll() {
    return this.resourceService.findAll();
  }

  @Post()
  async create(@Body(new JoiValidationPipe(CreateResourceSchema)) createResourceDto: CreateResourceDto) {
    return this.resourceService.create(createResourceDto);
  }
}
