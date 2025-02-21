import { Test, TestingModule } from '@nestjs/testing';
import { BookingController } from './booking.controller';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { User, UserRole } from '../../user/entities/user.entity';
import { Booking } from '../entities/booking.entity';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';

describe('BookingController', () => {
  let controller: BookingController;
  let service: jest.Mocked<BookingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        {
          provide: BookingService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findByUser: jest.fn(),
            remove: jest.fn(),
            checkAvailability: jest.fn(),
          },
        },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<BookingController>(BookingController);
    service = module.get<BookingService>(BookingService) as jest.Mocked<BookingService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a booking', async () => {
      const createBookingDto: CreateBookingDto = {
        resourceId: '1',
        userId: '1',
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
      const req = { user: { id: '1', name: 'Test User', password: 'password', email: 'test@example.com', apartment: '101' } };

      jest.spyOn(service, 'create').mockResolvedValue(result);

      expect(await controller.create(createBookingDto, req as any)).toBe(result);
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
            name: 'Test Resource',
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
            apartment: '102',
            block: 1,
            role: UserRole.RESIDENT,
            email: 'test2@example.com',
            password: 'password'
          },
          resource: {
            id: '2',
            name: 'Test Resource 2',
            type: 'Test Type 2',
            bookings: [] 
          }
        },
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
      jest.spyOn(service, 'findAll').mockResolvedValue(expectedBookings);

      expect(await controller.findAll()).toEqual(expectedBookings);
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
            id: '2', 
            name: 'Test User 2', 
            apartment: '102',
            block: 1,
            role: UserRole.RESIDENT,
            email: 'test2@example.com',
            password: 'password'
          },
          resource: {
            id: '1',
            name: 'Test Resource',
            type: 'Test Type',
            bookings: [] 
          },
        },
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
      jest.spyOn(service, 'findByUser').mockResolvedValue(expectedBookings);

      expect(await controller.findByUser('1')).toEqual(expectedBookings);
    });
  });

  describe('remove', () => {
    it('should remove a booking', async () => {
      const result = { message: 'Booking removed successfully' };
      jest.spyOn(service, 'remove').mockResolvedValue(result);

      expect(await controller.remove('1')).toEqual(result);
    });
  });

  describe('checkAvailability', () => {
    it('should check availability of a resource', async () => {
      const result = { available: true, message: 'Available' };
      jest.spyOn(service, 'checkAvailability').mockResolvedValue(result);

      expect(await controller.checkAvailability('1', '2025-02-12T10:00:00Z', '2025-02-12T12:00:00Z')).toBe(result);
    });
  });
});
