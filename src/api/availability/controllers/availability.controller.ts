import { Controller, Get, Param } from '@nestjs/common';
import { AvailabilityService } from '../services/availability.service';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(':resourceId')
  async findByResource(@Param('resourceId') resourceId: string) {
    return this.availabilityService.findByResource(resourceId);
  }
}
