import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../entities/booking.entity';
import { Repository } from 'typeorm';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { ResourceService } from '../../resource/services/resource.service';
import { User, UserRole } from '../../user/entities/user.entity';
import { Resource } from '../../resource/entities/resource.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepository: jest.Mocked<Repository<Booking>>;
  let resourceRepository: jest.Mocked<Repository<Resource>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let resourceService: jest.Mocked<ResourceService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: getRepositoryToken(Booking), useClass: Repository },
        { provide: getRepositoryToken(Resource), useClass: Repository },
        { provide: getRepositoryToken(User), useClass: Repository },
        {
          provide: ResourceService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    bookingRepository = module.get(getRepositoryToken(Booking));
    resourceRepository = module.get(getRepositoryToken(Resource));
    userRepository = module.get(getRepositoryToken(User));
    resourceService = module.get(ResourceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createBookingDto: CreateBookingDto = {
      userId: 'user-1',
      resourceId: 'resource-1',
      startTime: new Date('2026-06-10T12:00:00.000Z'),
      endTime: new Date('2026-06-10T15:00:00.000Z'),
      needTablesAndChairs: true,
      bookedOnBehalf: undefined,
    };

    it('creates booking for admin and keeps bookedOnBehalf', async () => {
      const createdBooking = {
        id: 'booking-1',
        ...createBookingDto,
        user: { id: 'user-1' },
        resource: { id: 'resource-1' },
      } as unknown as Booking;

      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: true, message: 'Available' });
      jest.spyOn(resourceService, 'findOne').mockResolvedValue({ id: 'resource-1' } as Resource);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 'user-1', role: UserRole.ADMIN } as User);
      jest.spyOn(bookingRepository, 'create').mockReturnValue(createdBooking);
      jest.spyOn(bookingRepository, 'save').mockResolvedValue(createdBooking);

      const result = await service.create(
        { ...createBookingDto, bookedOnBehalf: 'Family Event' },
        'user-1',
        UserRole.ADMIN,
      );

      expect(result.message).toBe('Booking created successfully');
      expect(result.booking).toEqual(createdBooking);
      expect(bookingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bookedOnBehalf: 'Family Event',
          needTablesAndChairs: true,
        }),
      );
    });

    it('throws when startTime is today or in the past', async () => {
      const dto: CreateBookingDto = {
        ...createBookingDto,
        startTime: new Date(Date.now() - 86_400_000),
      };

      await expect(service.create(dto, 'user-1', UserRole.RESIDENT)).rejects.toThrow(BadRequestException);
    });

    it('throws when resource is not available', async () => {
      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: false, message: 'Not available' });

      await expect(service.create(createBookingDto, 'user-1', UserRole.RESIDENT)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('applies date range filters and maps paginated response', async () => {
      const bookings: Booking[] = [
        {
          id: 'booking-1',
          resourceId: 'resource-1',
          userId: 'user-1',
          startTime: new Date('2026-06-10T12:00:00.000Z'),
          endTime: new Date('2026-06-10T15:00:00.000Z'),
          needTablesAndChairs: true,
          bookedOnBehalf: undefined,
          user: { id: 'user-1', apartment: '101', block: 1 } as User,
          resource: { id: 'resource-1', name: 'Party Hall', type: 'hall' } as Resource,
        } as Booking,
      ];

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([bookings, 1]),
      };

      bookingRepository.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder as any);

      const result = await service.findAll(1, 10, 'startTime', 'ASC', '2026-06-10', '2026-06-11');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('booking.startTime >= :startDate', {
        startDate: '2026-06-10T00:00:00.000Z',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('booking.startTime <= :endDate', {
        endDate: '2026-06-11T23:59:59.999Z',
      });
      expect(result).toEqual({
        data: [
          {
            id: 'booking-1',
            resourceId: 'resource-1',
            resourceName: 'Party Hall',
            resourceType: 'hall',
            startTime: new Date('2026-06-10T12:00:00.000Z'),
            endTime: new Date('2026-06-10T15:00:00.000Z'),
            userId: 'user-1',
            userApartment: '101',
            userBlock: 1,
            bookedOnBehalf: undefined,
            needTablesAndChairs: true,
          },
        ],
        total: 1,
        page: 1,
        lastPage: 1,
      });
    });
  });

  describe('findByUser', () => {
    it('returns paginated user bookings', async () => {
      const bookings = [
        {
          id: 'booking-1',
          startTime: new Date('2026-06-10T12:00:00.000Z'),
          endTime: new Date('2026-06-10T15:00:00.000Z'),
          needTablesAndChairs: false,
          bookedOnBehalf: undefined,
          user: { id: 'user-1', apartment: '101', block: 1 },
          resource: { id: 'resource-1', name: 'Party Hall', type: 'hall' },
        },
      ];

      jest.spyOn(bookingRepository, 'findAndCount').mockResolvedValue([bookings as Booking[], 1]);

      const result = await service.findByUser('user-1', 1, 10, 'startTime', 'ASC');

      expect(result).toEqual({
        data: [
          {
            id: 'booking-1',
            resourceId: 'resource-1',
            resourceName: 'Party Hall',
            resourceType: 'hall',
            startTime: new Date('2026-06-10T12:00:00.000Z'),
            endTime: new Date('2026-06-10T15:00:00.000Z'),
            userId: 'user-1',
            userApartment: '101',
            userBlock: 1,
            bookedOnBehalf: undefined,
            needTablesAndChairs: false,
          },
        ],
        total: 1,
        page: 1,
        lastPage: 1,
      });
    });
  });

  describe('remove', () => {
    it('removes booking when requester is owner', async () => {
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue({ id: 'booking-1', user: { id: 'user-1' } } as Booking);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 'user-1', role: UserRole.RESIDENT } as User);
      jest.spyOn(bookingRepository, 'remove').mockResolvedValue({ id: 'booking-1' } as Booking);

      await expect(service.remove('booking-1', 'user-1')).resolves.toEqual({
        message: 'Booking removed successfully',
      });
    });

    it('throws NotFound when booking does not exist', async () => {
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('missing-booking', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkAvailability', () => {
    it('throws when resource does not exist', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.checkAvailability('resource-1', new Date('2026-06-10T12:00:00.000Z'), new Date('2026-06-10T15:00:00.000Z')),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns not available on overlapping bookings', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'hall' } as Resource);
      jest.spyOn(bookingRepository, 'find').mockResolvedValue([
        {
          startTime: new Date('2026-06-10T12:30:00.000Z'),
          endTime: new Date('2026-06-10T13:30:00.000Z'),
          user: { apartment: '101' },
        } as Booking,
      ]);

      const result = await service.checkAvailability(
        'resource-1',
        new Date('2026-06-10T12:00:00.000Z'),
        new Date('2026-06-10T15:00:00.000Z'),
      );

      expect(result.available).toBe(false);
      expect(result.message).toContain('already booked by apartment 101');
    });

    it('enforces tennis daily cap of 2 hours per user', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'tennis' } as Resource);
      jest.spyOn(bookingRepository, 'find').mockResolvedValue([]);

      const queryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'booking-1',
            startTime: new Date('2026-06-10T08:00:00.000Z'),
            endTime: new Date('2026-06-10T10:00:00.000Z'),
          },
        ]),
      };
      bookingRepository.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder as any);

      const result = await service.checkAvailability(
        'resource-1',
        new Date('2026-06-10T10:00:00.000Z'),
        new Date('2026-06-10T11:00:00.000Z'),
        { userId: 'user-1' },
      );

      expect(result.available).toBe(false);
      expect(result.message).toContain('more than 2 total tennis hours');
    });
  });

  describe('update', () => {
    it('blocks update when requester is not owner or admin', async () => {
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue({
        id: 'booking-1',
        user: { id: 'owner-1' },
        resource: { id: 'resource-1' },
        startTime: new Date('2026-06-10T10:00:00.000Z'),
        endTime: new Date('2026-06-10T11:00:00.000Z'),
      } as unknown as Booking);

      await expect(
        service.update(
          'booking-1',
          { startTime: new Date('2026-06-11T10:00:00.000Z') },
          'other-user',
          UserRole.RESIDENT,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
