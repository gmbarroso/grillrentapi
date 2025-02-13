import { Module } from '@nestjs/common';
import { AvailabilityService } from './services/availability.service';
import { AvailabilityController } from './controllers/availability.controller';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
