import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Availability } from '../entities/availability.entity';
import { Repository } from 'typeorm';
import { CheckAvailabilityDto } from '../dto/check-availability.dto';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let availabilityRepository: Repository<Availability>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: getRepositoryToken(Availability),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    availabilityRepository = module.get<Repository<Availability>>(getRepositoryToken(Availability));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAvailability', () => {
    it('should return available if no conflicts', async () => {
      const checkAvailabilityDto: CheckAvailabilityDto = {
        resourceId: '1',
        startTime: new Date('2025-02-12T10:00:00Z'),
        endTime: new Date('2025-02-12T12:00:00Z'),
      };
      jest.spyOn(availabilityRepository, 'find').mockResolvedValue([]);

      const result = await service.checkAvailability(checkAvailabilityDto);
      expect(result).toEqual({ available: true, message: 'Available' });
    });

    it('should return not available if conflicts exist', async () => {
      const checkAvailabilityDto: CheckAvailabilityDto = {
        resourceId: '1',
        startTime: new Date('2025-02-12T10:00:00Z'),
        endTime: new Date('2025-02-12T12:00:00Z'),
      };
      const conflict = { id: 1, resourceId: '1', startTime: new Date('2025-02-12T11:00:00Z'), endTime: new Date('2025-02-12T13:00:00Z') } as Availability;
      jest.spyOn(availabilityRepository, 'find').mockResolvedValue([conflict]);

      const result = await service.checkAvailability(checkAvailabilityDto);
      expect(result).toEqual({ available: false, message: 'Not available' });
    });
  });
});
