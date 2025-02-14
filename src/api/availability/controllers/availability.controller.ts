import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AvailabilityService } from '../services/availability.service';
import { CheckAvailabilityDto, CheckAvailabilitySchema } from '../dto/check-availability.dto';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';

@Controller('availability')
export class AvailabilityController {
  private readonly logger = new Logger(AvailabilityController.name);

  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post()
  async checkAvailability(@Body(new JoiValidationPipe(CheckAvailabilitySchema)) checkAvailabilityDto: CheckAvailabilityDto) {
    this.logger.log(`Checking availability for resource ID: ${checkAvailabilityDto.resourceId}`);
    return this.availabilityService.checkAvailability(checkAvailabilityDto);
  }
}
