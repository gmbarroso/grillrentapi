import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../entities/booking.entity';
import { Repository } from 'typeorm';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { ResourceService } from '../../resource/services/resource.service';
import { User, UserRole } from '../../user/entities/user.entity';
import { Resource } from '../../resource/entities/resource.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepository: Repository<Booking>;
  let resourceRepository: Repository<Resource>;
  let userRepository: Repository<User>;
  let resourceService: jest.Mocked<ResourceService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: getRepositoryToken(Booking),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Resource),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
        {
          provide: ResourceService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    bookingRepository = module.get<Repository<Booking>>(getRepositoryToken(Booking));
    resourceRepository = module.get<Repository<Resource>>(getRepositoryToken(Resource));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    resourceService = module.get<ResourceService>(ResourceService) as jest.Mocked<ResourceService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a booking', async () => {
      const createBookingDto: CreateBookingDto = {
        userId: '1',
        resourceId: '1',
        startTime: new Date(),
        endTime: new Date(),
      };
      const booking: Booking = { 
        id: '1', 
        ...createBookingDto, 
        user: { 
          id: '1', 
          name: 'Test User', 
          password: 'password', 
          email: 'test@example.com', 
          apartment: '101',
          block: 1,
          role: UserRole.RESIDENT
        }, 
        resource: {
          id: '1',
          name: 'Test Resource',
          type: 'Test Type',
          bookings: [] 
        }
      };
      const result = { message: 'Booking created successfully', booking };

      jest.spyOn(bookingRepository, 'create').mockReturnValue(booking as any);
      jest.spyOn(bookingRepository, 'save').mockResolvedValue(booking as any);
      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: true, message: 'Available' });
      jest.spyOn(resourceService, 'findOne').mockResolvedValue(booking.resource as any);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(booking.user as any);

      const createdBooking = await service.create(createBookingDto, '1');
      expect(createdBooking).toEqual(result);
    });

    it('should throw a BadRequestException if booking is for today or a past date', async () => {
      const createBookingDto: CreateBookingDto = {
        resourceId: '1',
        userId: '1',
        startTime: new Date(Date.now() - 86400000), // 1 day in the past
        endTime: new Date(),
      };

      await expect(service.create(createBookingDto, '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw a BadRequestException if resource is not available', async () => {
      const createBookingDto: CreateBookingDto = {
        resourceId: '1',
        userId: '1',
        startTime: new Date(),
        endTime: new Date(),
      };

      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: false, message: 'Not available' });

      await expect(service.create(createBookingDto, '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw a BadRequestException if resource is not found', async () => {
      const createBookingDto: CreateBookingDto = {
        resourceId: '1',
        userId: '1',
        startTime: new Date(),
        endTime: new Date(),
      };

      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: true, message: 'Available' });
      jest.spyOn(resourceService, 'findOne').mockResolvedValue(null as any);

      await expect(service.create(createBookingDto, '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw a BadRequestException if user is not found', async () => {
      const createBookingDto: CreateBookingDto = {
        resourceId: '1',
        userId: '1',
        startTime: new Date(),
        endTime: new Date(),
      };

      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: true, message: 'Available' });
      jest.spyOn(resourceService, 'findOne').mockResolvedValue({ id: '1', name: 'Test Resource', type: 'Test Type', description: 'Test Description', bookings: [] } as any);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null as any);

      await expect(service.create(createBookingDto, '1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should find all bookings', async () => {
      const bookings: Booking[] = [
        { 
          id: '1', 
          resourceId: '1', 
          userId: '1',
          startTime: new Date(), 
          endTime: new Date(),
          user: { 
            id: '1', 
            name: 'Test User', 
            password: 'password', 
            email: 'test@example.com', 
            apartment: '101',
            block: 1,
            role: UserRole.RESIDENT
          }, 
          resource: {
            id: '1',
            name: "Test Resource",
            type: 'Test Type',
            bookings: [] 
          }
        },
        { 
          id: '2', 
          resourceId: '2', 
          userId: '2',
          startTime: new Date(), 
          endTime: new Date(),
          user: { 
            id: '2', 
            name: 'Test User 2', 
            password: 'password',
            apartment: '102',
            block: 2,
            role: UserRole.RESIDENT,
            email: 'test2@example.com',
          },
          resource: {
            id: '2',
            name: 'Test Resource 2',
            type: 'Test Type 2',
            bookings: [] 
          }
        }
      ];
      const expectedBookings = bookings.map(booking => ({
        id: booking.id,
        resourceId: booking.resourceId,
        resourceName: booking.resource.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
        userId: booking.userId,
        userApartment: booking.user.apartment,
      }));
      jest.spyOn(bookingRepository, 'find').mockResolvedValue(bookings as any);

      const result = await service.findAll();
      expect(result).toEqual(expectedBookings);
    });
  });

  describe('findByUser', () => {
    it('should find bookings by user', async () => {
      const bookings: Booking[] = [
        { 
          id: '1', 
          resourceId: '1', 
          userId: '1',
          startTime: new Date(), 
          endTime: new Date(),
          user: { 
            id: '1', 
            name: 'Test User', 
            password: 'password', 
            email: 'test@example.com', 
            apartment: '101',
            block: 1,
            role: UserRole.RESIDENT
          }, 
          resource: {
            id: '1',
            name: 'Test Resource',
            type: 'Test Type',
            bookings: [] 
          }
        }
      ];
      const expectedBookings = bookings.map(booking => ({
        id: booking.id,
        resourceId: booking.resourceId,
        resourceName: booking.resource.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
        userId: booking.userId,
        userApartment: booking.user.apartment,
      }));
      jest.spyOn(bookingRepository, 'find').mockResolvedValue(bookings as any);

      const result = await service.findByUser('1');
      expect(result).toEqual(expectedBookings);
    });
  });

  describe('remove', () => {
    it('should remove a booking', async () => {
      const booking: Booking = {
        id: '1',
        resourceId: '1',
        userId: '1',
        startTime: new Date(),
        endTime: new Date(),
        user: { 
          id: '1', 
          name: 'Test User', 
          password: 'password', 
          email: 'test@example.com', 
          apartment: '101',
          block: 1,
          role: UserRole.RESIDENT
        }, 
        resource: {
          id: '1',
          name: 'Test Resource',
          type: 'Test Type',
          bookings: []
        }
      };
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(booking as any);
      jest.spyOn(bookingRepository, 'remove').mockResolvedValue(booking as any);

      const result = await service.remove('1');
      expect(result).toEqual({ message: 'Booking removed successfully' });
    });

    it('should throw a NotFoundException if booking not found', async () => {
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(null as any);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkAvailability', () => {
    it('should check availability of a resource', async () => {
      const result = { available: true, message: 'Available' };
      const bookings: Booking[] = [];
      jest.spyOn(bookingRepository, 'find').mockResolvedValue(bookings as any);

      const availability = await service.checkAvailability('1', new Date(), new Date());
      expect(availability).toEqual(result);
    });

    it('should return not available if resource is already booked', async () => {
      const result = { available: false, message: 'Resource is already booked by apartment 101 at the specified time' };
      const bookings: Booking[] = [
        {
          id: '1',
          resourceId: '1',
          userId: '1',
          startTime: new Date(),
          endTime: new Date(),
          user: { 
            id: '1', 
            name: 'Test User', 
            password: 'password', 
            email: 'test@example.com', 
            apartment: '101',
            block: 1,
            role: UserRole.RESIDENT
          }, 
          resource: {
            id: '1',
            name: 'Test Resource',
            type: 'Test Type',
            bookings: []
          }
        }
      ];
      jest.spyOn(bookingRepository, 'find').mockResolvedValue(bookings as any);

      const availability = await service.checkAvailability('1', new Date(), new Date());
      expect(availability).toEqual(result);
    });
  });
});
