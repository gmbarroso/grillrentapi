import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookingDto } from '../dto/create-booking.dto';

@Injectable()
export class BookingService {
  private bookings: Array<{ id: number; userId: string; resourceId: string; startTime: Date; endTime: Date }> = [];

  async create(createBookingDto: CreateBookingDto, userId: string) {
    const booking = { id: Date.now(), ...createBookingDto, userId };
    this.bookings.push(booking);
    return { message: 'Booking created successfully', booking };
  }

  async findByUser(userId: string) {
    return this.bookings.filter(booking => booking.userId === userId);
  }

  async remove(bookingId: string) {
    const bookingIndex = this.bookings.findIndex(booking => booking.id === parseInt(bookingId));
    if (bookingIndex === -1) {
      throw new NotFoundException('Booking not found');
    }
    this.bookings.splice(bookingIndex, 1);
    return { message: 'Booking removed successfully' };
  }
}
