import { Module } from '@nestjs/common';
import { UserModule } from './api/user/user.module';
import { ResourceModule } from './api/resource/resource.module';
import { AvailabilityModule } from './api/availability/availability.module';
import { BookingModule } from './api/booking/booking.module';

@Module({
  imports: [
    UserModule,
    ResourceModule,
    AvailabilityModule,
    BookingModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
