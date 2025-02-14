import { Controller, Get, Param, Query, Logger, BadRequestException } from '@nestjs/common';
import { AvailabilityService } from '../services/availability.service';

@Controller('availability')
export class AvailabilityController {
  private readonly logger = new Logger(AvailabilityController.name);

  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(':resourceId')
  async checkAvailability(
    @Param('resourceId') resourceId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    this.logger.log(`Checking availability for resource ID: ${resourceId}`);

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      this.logger.warn(`Invalid date format for startTime or endTime`);
      throw new BadRequestException('Invalid date format for startTime or endTime');
    }

    return this.availabilityService.checkAvailability(resourceId, start, end);
  }
}
