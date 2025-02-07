import { Injectable } from '@nestjs/common';
import { BookingRepository } from './booking.repository';
import { Booking } from '../entities/booking.entity';

@Injectable()
export class BookingService {
  constructor(private readonly bookingRepository: BookingRepository) {}

  async create(booking: Partial<Booking>): Promise<Booking> {
    return this.bookingRepository.create(booking);
  }

  async findAll(): Promise<Booking[]> {
    return this.bookingRepository.findAll();
  }

  async findOne(id: number): Promise<Booking> {
    const booking = await this.bookingRepository.findOne(id);
    if (!booking) {
      throw new Error(`Booking with id ${id} not found`);
    }
    return booking;
  }

  async update(id: number, booking: Partial<Booking>): Promise<Booking> {
    const updatedBooking = await this.bookingRepository.update(id, booking);
    if (!updatedBooking) {
      throw new Error(`Booking with id ${id} not found`);
    }
    return updatedBooking;
  }

  async remove(id: number): Promise<void> {
    return this.bookingRepository.remove(id);
  }
}
