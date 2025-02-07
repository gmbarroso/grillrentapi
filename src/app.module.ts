import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from '../mikro-orm.config';
import { UserModule } from './user/user.module';
import { ResourceModule } from './resource/resource.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingModule } from './booking/booking.module';

@Module({
  imports: [
    MikroOrmModule.forRoot(mikroOrmConfig),
    UserModule,
    ResourceModule,
    AvailabilityModule,
    BookingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
