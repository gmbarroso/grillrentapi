import { Injectable } from '@nestjs/common';
import { AvailabilityRepository } from './availability.repository';
import { Availability } from '../entities/availability.entity';

@Injectable()
export class AvailabilityService {
  constructor(private readonly availabilityRepository: AvailabilityRepository) {}

  async create(availability: Partial<Availability>): Promise<Availability> {
    return this.availabilityRepository.create(availability);
  }

  async findAll(): Promise<Availability[]> {
    return this.availabilityRepository.findAll();
  }

  async findOne(id: number): Promise<Availability> {
    return this.availabilityRepository.findOne(id);
  }

  async update(id: number, availability: Partial<Availability>): Promise<Availability> {
    return this.availabilityRepository.update(id, availability);
  }

  async remove(id: number): Promise<void> {
    return this.availabilityRepository.remove(id);
  }
}
