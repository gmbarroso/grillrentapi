import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../entities/booking.entity';
import { Repository } from 'typeorm';
import { ResourceService } from '../../resource/services/resource.service';
import { AvailabilityService } from '../../availability/services/availability.service';
import { CreateBookingDto } from '../dto/create-booking.dto';

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepository: Repository<Booking>;
  let resourceService: ResourceService;
  let availabilityService: AvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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

    service = module.get<BookingService>(BookingService);
    bookingRepository = module.get<Repository<Booking>>(getRepositoryToken(Booking));
    resourceService = module.get<ResourceService>(ResourceService);
    availabilityService = module.get<AvailabilityService>(AvailabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a booking', async () => {
      const createBookingDto: CreateBookingDto = {
        resourceId: '1',
        startTime: new Date('2025-02-12T10:00:00Z'),
        endTime: new Date('2025-02-12T12:00:00Z'),
      };
      const userId = '1';
      const resource = { id: 1, name: 'Tennis Court', type: 'tennis', description: 'A nice tennis court' };
      const isAvailable = { available: true, message: 'Available' };
      const booking = { ...createBookingDto, id: 1, userId } as Booking;

      jest.spyOn(resourceService, 'findOne').mockResolvedValue(resource as any);
      jest.spyOn(availabilityService, 'checkAvailability').mockResolvedValue(isAvailable);
      jest.spyOn(bookingRepository, 'create').mockReturnValue(booking);
      jest.spyOn(bookingRepository, 'save').mockResolvedValue(booking);

      const result = await service.create(createBookingDto, userId);
      expect(result).toEqual({ message: 'Booking created successfully', booking });
    });

    it('should throw an error if resource not found', async () => {
      const createBookingDto: CreateBookingDto = {
        resourceId: '1',
        startTime: new Date('2025-02-12T10:00:00Z'),
        endTime: new Date('2025-02-12T12:00:00Z'),
      };
      const userId = '1';

      jest.spyOn(resourceService, 'findOne').mockResolvedValue(null as any);

      await expect(service.create(createBookingDto, userId)).rejects.toThrow('Resource not found');
    });

    it('should throw an error if resource is not available', async () => {
      const createBookingDto: CreateBookingDto = {
        resourceId: '1',
        startTime: new Date('2025-02-12T10:00:00Z'),
        endTime: new Date('2025-02-12T12:00:00Z'),
      };
      const userId = '1';
      const resource = { id: 1, name: 'Tennis Court', type: 'tennis', description: 'A nice tennis court' };
      const isAvailable = { available: false, message: 'Not available' };

      jest.spyOn(resourceService, 'findOne').mockResolvedValue(resource as any);
      jest.spyOn(availabilityService, 'checkAvailability').mockResolvedValue(isAvailable);

      await expect(service.create(createBookingDto, userId)).rejects.toThrow('Not available');
    });
  });

  describe('findByUser', () => {
    it('should return bookings for a user', async () => {
      const userId = '1';
      const bookings = [
        { id: 1, resourceId: '1', userId, startTime: new Date('2025-02-12T10:00:00Z'), endTime: new Date('2025-02-12T12:00:00Z') },
      ] as Booking[];
      jest.spyOn(bookingRepository, 'find').mockResolvedValue(bookings);

      const result = await service.findByUser(userId);
      expect(result).toEqual(bookings);
    });
  });

  describe('remove', () => {
    it('should remove a booking', async () => {
      const bookingId = '1';
      const booking = { id: 1, resourceId: '1', userId: '1', startTime: new Date('2025-02-12T10:00:00Z'), endTime: new Date('2025-02-12T12:00:00Z') } as Booking;
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(booking);
      jest.spyOn(bookingRepository, 'remove').mockResolvedValue(booking);

      const result = await service.remove(bookingId);
      expect(result).toEqual({ message: 'Booking removed successfully' });
    });

    it('should throw an error if booking not found', async () => {
      const bookingId = '1';
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(null as any);

      await expect(service.remove(bookingId)).rejects.toThrow('Booking not found');
    });
  });
});
