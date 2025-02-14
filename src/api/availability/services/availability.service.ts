import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Booking } from '../../booking/entities/booking.entity';

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  async checkAvailability(resourceId: string, startTime: Date, endTime: Date) {
    if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
      throw new Error('Invalid start time');
    }
    if (!(endTime instanceof Date) || isNaN(endTime.getTime())) {
      throw new Error('Invalid end time');
    }

    this.logger.log(`Checking availability for resource ID: ${resourceId} from ${startTime} to ${endTime}`);
    const overlappingBookings = await this.bookingRepository.find({
      where: {
        resourceId,
        startTime: LessThanOrEqual(endTime),
        endTime: MoreThanOrEqual(startTime),
      },
    });

    if (overlappingBookings.length > 0) {
      this.logger.warn(`Resource ID: ${resourceId} is not available from ${startTime} to ${endTime}`);
      return { available: false, message: 'Resource is not available in the specified time range' };
    }

    this.logger.log(`Resource ID: ${resourceId} is available from ${startTime} to ${endTime}`);
    return { available: true, message: 'Resource is available in the specified time range' };
  }
}
