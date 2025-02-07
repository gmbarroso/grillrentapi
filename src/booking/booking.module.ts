import { Module } from '@nestjs.common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { BookingRepository } from './booking.repository';

@Module({
  providers: [BookingService, BookingRepository],
  controllers: [BookingController],
  exports: [BookingService],
})
export class BookingModule {}
