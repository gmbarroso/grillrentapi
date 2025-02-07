import { Injectable } from '@nestjs/common';
import { Availability } from '../entities/availability.entity';

@Injectable()
export class AvailabilityRepository {
  private availabilities: Availability[] = [];

  async create(availability: Partial<Availability>): Promise<Availability> {
    const newAvailability = { id: Date.now(), ...availability } as Availability;
    this.availabilities.push(newAvailability);
    return newAvailability;
  }

  async findAll(): Promise<Availability[]> {
    return this.availabilities;
  }

  async findOne(id: number): Promise<Availability> {
    const availability = this.availabilities.find(availability => availability.id === id);
    if (!availability) {
      throw new Error(`Availability with id ${id} not found`);
    }
    return availability;
  }

  async update(id: number, availability: Partial<Availability>): Promise<Availability> {
    const index = this.availabilities.findIndex(availability => availability.id === id);
    if (index === -1) {
      throw new Error(`Availability with id ${id} not found`);
    }
    this.availabilities[index] = { ...this.availabilities[index], ...availability };
    return this.availabilities[index];
  }

  async remove(id: number): Promise<void> {
    this.availabilities = this.availabilities.filter(availability => availability.id !== id);
  }
}
