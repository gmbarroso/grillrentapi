import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { BookingService } from './booking.service';
import { Booking } from '../entities/booking.entity';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  async create(@Body() createBookingDto: Partial<Booking>) {
    return this.bookingService.create(createBookingDto);
  }

  @Get()
  async findAll() {
    return this.bookingService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.bookingService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() updateBookingDto: Partial<Booking>) {
    return this.bookingService.update(id, updateBookingDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: number) {
    return this.bookingService.remove(id);
  }
}
