import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from '../services/availability.service';
import { CheckAvailabilityDto } from '../dto/check-availability.dto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Availability } from '../entities/availability.entity';
import { Repository } from 'typeorm';

describe('AvailabilityController', () => {
  let controller: AvailabilityController;
  let service: AvailabilityService;
  let availabilityRepository: Repository<Availability>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [
        AvailabilityService,
        {
          provide: getRepositoryToken(Availability),
          useClass: Repository,
        },
      ],
    }).compile();

    controller = module.get<AvailabilityController>(AvailabilityController);
    service = module.get<AvailabilityService>(AvailabilityService);
    availabilityRepository = module.get<Repository<Availability>>(getRepositoryToken(Availability));
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkAvailability', () => {
    it('should return available if no conflicts', async () => {
      const checkAvailabilityDto: CheckAvailabilityDto = {
        resourceId: '1',
        startTime: new Date('2025-02-12T10:00:00Z'),
        endTime: new Date('2025-02-12T12:00:00Z'),
      };
      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: true, message: 'Available' });

      const result = await controller.checkAvailability(checkAvailabilityDto);
      expect(result).toEqual({ available: true, message: 'Available' });
    });

    it('should return not available if conflicts exist', async () => {
      const checkAvailabilityDto: CheckAvailabilityDto = {
        resourceId: '1',
        startTime: new Date('2025-02-12T10:00:00Z'),
        endTime: new Date('2025-02-12T12:00:00Z'),
      };
      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: false, message: 'Not available' });

      const result = await controller.checkAvailability(checkAvailabilityDto);
      expect(result).toEqual({ available: false, message: 'Not available' });
    });
  });
});
