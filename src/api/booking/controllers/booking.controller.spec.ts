import { Test, TestingModule } from '@nestjs/testing';
import { BookingController } from './booking.controller';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../entities/booking.entity';
import { Repository } from 'typeorm';
import { ResourceService } from '../../resource/services/resource.service';
import { AvailabilityService } from '../../availability/services/availability.service';

describe('BookingController', () => {
  let controller: BookingController;
  let service: BookingService;
  let bookingRepository: Repository<Booking>;
  let resourceService: ResourceService;
  let availabilityService: AvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        BookingService,
        {
          provide: getRepositoryToken(Booking),
          useClass: Repository,
        },
        {
          provide: ResourceService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: AvailabilityService,
          useValue: {
            checkAvailability: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BookingController>(BookingController);
    service = module.get<BookingService>(BookingService);
    bookingRepository = module.get<Repository<Booking>>(getRepositoryToken(Booking));
    resourceService = module.get<ResourceService>(ResourceService);
    availabilityService = module.get<AvailabilityService>(AvailabilityService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a booking', async () => {
      const createBookingDto: CreateBookingDto = {
        resourceId: '1',
        startTime: new Date('2025-02-12T10:00:00Z'),
        endTime: new Date('2025-02-12T12:00:00Z'),
      };
      const userId = '1';
      const booking = { ...createBookingDto, id: 1, userId } as Booking;

      jest.spyOn(service, 'create').mockResolvedValue({ message: 'Booking created successfully', booking });

      const result = await controller.create(createBookingDto, userId);
      expect(result).toEqual({ message: 'Booking created successfully', booking });
    });
  });

  describe('findByUser', () => {
    it('should return bookings for a user', async () => {
      const userId = '1';
      const bookings = [
        { id: 1, resourceId: '1', userId, startTime: new Date('2025-02-12T10:00:00Z'), endTime: new Date('2025-02-12T12:00:00Z') },
      ] as Booking[];
      jest.spyOn(service, 'findByUser').mockResolvedValue(bookings);

      const result = await controller.findByUser(userId);
      expect(result).toEqual(bookings);
    });
  });

  describe('remove', () => {
    it('should remove a booking', async () => {
      const bookingId = '1';
      jest.spyOn(service, 'remove').mockResolvedValue({ message: 'Booking removed successfully' });

      const result = await controller.remove(bookingId);
      expect(result).toEqual({ message: 'Booking removed successfully' });
    });
  });
});
