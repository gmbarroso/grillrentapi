import { Injectable } from '@nestjs/common';
import { Booking } from '../entities/booking.entity';

@Injectable()
export class BookingRepository {
  private bookings: Booking[] = [];

  async create(booking: Partial<Booking>): Promise<Booking> {
    const newBooking = { id: Date.now(), ...booking } as Booking;
    this.bookings.push(newBooking);
    return newBooking;
  }

  async findAll(): Promise<Booking[]> {
    return this.bookings;
  }

  async findOne(id: number): Promise<Booking> {
    const booking = this.bookings.find(booking => booking.id === id);
    if (!booking) {
      throw new Error(`Booking with id ${id} not found`);
    }
    return booking;
  }

  async update(id: number, booking: Partial<Booking>): Promise<Booking> {
    const index = this.bookings.findIndex(booking => booking.id === id);
    if (index === -1) {
      throw new Error(`Booking with id ${id} not found`);
    }
    this.bookings[index] = { ...this.bookings[index], ...booking };
    return this.bookings[index];
  }

  async remove(id: number): Promise<void> {
    this.bookings = this.bookings.filter(booking => booking.id !== id);
  }
}
