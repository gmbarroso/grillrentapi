import { Controller, Post, Get, Delete, Param, Body, UseGuards, Logger } from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto, CreateBookingSchema } from '../dto/create-booking.dto';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { User } from '../../../shared/auth/decorators/user.decorator';

@Controller('bookings')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(private readonly bookingService: BookingService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body(new JoiValidationPipe(CreateBookingSchema)) createBookingDto: CreateBookingDto, @User() user) {
    this.logger.log(`Creating booking for user ID: ${user.id}`);
    return this.bookingService.create(createBookingDto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    this.logger.log(`Fetching bookings for user ID: ${userId}`);
    return this.bookingService.findByUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':bookingId')
  async remove(@Param('bookingId') bookingId: string) {
    this.logger.log(`Removing booking ID: ${bookingId}`);
    return this.bookingService.remove(bookingId);
  }
}
