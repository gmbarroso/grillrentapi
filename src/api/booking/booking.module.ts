import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './services/booking.service';
import { BookingController } from './controllers/booking.controller';
import { Booking } from './entities/booking.entity';
import { Resource } from '../resource/entities/resource.entity';
import { User } from '../user/entities/user.entity';
import { ResourceModule } from '../resource/resource.module';
import { AuthService } from '../../shared/auth/services/auth.service';
import { JwtService } from '@nestjs/jwt';
import { RevokedToken } from '../../shared/auth/entities/revoked-token.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Resource, User, RevokedToken]),
    ResourceModule,
    UserModule,
  ],
  controllers: [BookingController],
  providers: [BookingService, AuthService, JwtService],
  exports: [BookingService],
})
export class BookingModule {}
