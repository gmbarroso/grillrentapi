import { Controller, Post, Body, Logger, Get, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from '../../user/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Controller('bookings')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(private readonly bookingService: BookingService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createBookingDto: CreateBookingDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id.toString();
    this.logger.log(`Creating booking for user ID: ${userId}`);
    return this.bookingService.create(createBookingDto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    this.logger.log(`Fetching bookings for user ID: ${userId}`);
    return this.bookingService.findByUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    this.logger.log('Fetching all bookings');
    return this.bookingService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id.toString();
    this.logger.log(`Removing booking ID: ${id} by user ID: ${userId}`);
    return this.bookingService.remove(id, userId);
  }

  @Get('availability/:resourceId')
  async checkAvailability(
    @Param('resourceId') resourceId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string
  ) {
    this.logger.log(`Checking availability for resource ID: ${resourceId} from ${startTime} to ${endTime}`);
    return this.bookingService.checkAvailability(resourceId, new Date(startTime), new Date(endTime));
  }
}
