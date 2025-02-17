import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './services/booking.service';
import { BookingController } from './controllers/booking.controller';
import { Booking } from './entities/booking.entity';
import { Resource } from '../resource/entities/resource.entity';
import { User } from '../user/entities/user.entity';
import { ResourceModule } from '../resource/resource.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Resource, User]),
    ResourceModule
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
