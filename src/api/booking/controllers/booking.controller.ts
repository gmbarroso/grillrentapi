import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto, CreateBookingSchema } from '../dto/create-booking.dto';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { User } from '../../../shared/auth/decorators/user.decorator';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body(new JoiValidationPipe(CreateBookingSchema)) createBookingDto: CreateBookingDto, @User() user) {
    return this.bookingService.create(createBookingDto, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    return this.bookingService.findByUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':bookingId')
  async remove(@Param('bookingId') bookingId: string) {
    return this.bookingService.remove(bookingId);
  }
}
