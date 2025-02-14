import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Availability } from '../entities/availability.entity';
import { CheckAvailabilityDto } from '../dto/check-availability.dto';

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    @InjectRepository(Availability)
    private readonly availabilityRepository: Repository<Availability>,
  ) {}

  async checkAvailability(checkAvailabilityDto: CheckAvailabilityDto) {
    const { resourceId, startTime, endTime } = checkAvailabilityDto;
    this.logger.log(`Checking availability for resource ID: ${resourceId} from ${startTime} to ${endTime}`);
    
    const conflicts = await this.availabilityRepository.find({
      where: [
        { resourceId, startTime: LessThanOrEqual(endTime), endTime: MoreThanOrEqual(startTime) },
      ],
    });

    if (conflicts.length > 0) {
      this.logger.warn(`Resource ID: ${resourceId} is not available from ${startTime} to ${endTime}`);
      return { available: false, message: 'Not available' };
    }

    this.logger.log(`Resource ID: ${resourceId} is available from ${startTime} to ${endTime}`);
    return { available: true, message: 'Available' };
  }
}
