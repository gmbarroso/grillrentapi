import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { Availability } from '../entities/availability.entity';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post()
  async create(@Body() createAvailabilityDto: Partial<Availability>) {
    return this.availabilityService.create(createAvailabilityDto);
  }

  @Get()
  async findAll() {
    return this.availabilityService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.availabilityService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() updateAvailabilityDto: Partial<Availability>) {
    return this.availabilityService.update(id, updateAvailabilityDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: number) {
    return this.availabilityService.remove(id);
  }
}
