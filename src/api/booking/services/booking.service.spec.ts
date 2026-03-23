import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../entities/booking.entity';
import { Repository } from 'typeorm';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { ResourceService } from '../../resource/services/resource.service';
import { User, UserRole } from '../../user/entities/user.entity';
import { Resource } from '../../resource/entities/resource.entity';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('BookingService', () => {
  const ORG_ID = '9dd02335-74fa-487b-99f3-f3e6f9fba2af';
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
        ORG_ID,
      );

      expect(result.message).toBe('Booking created successfully');
      expect(result.booking).toMatchObject({
        id: 'booking-1',
        startTime: '2026-06-10T12:00:00.000Z',
        endTime: '2026-06-10T15:00:00.000Z',
      });
      expect(result.booking.startTime).toMatch(/Z$/);
      expect(result.booking.endTime).toMatch(/Z$/);
      expect(bookingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bookedOnBehalf: 'Family Event',
          needTablesAndChairs: true,
        }),
      );
    });

    it('throws when startTime is today or in the past', async () => {
      const now = new Date();
      const dto: CreateBookingDto = {
        ...createBookingDto,
        startTime: now,
        endTime: new Date(now.getTime() + 3_600_000),
      };
      jest.spyOn(resourceService, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'grill' } as Resource);

      await expect(service.create(dto, 'user-1', UserRole.RESIDENT, ORG_ID)).rejects.toThrow(BadRequestException);
    });

    it('allows same-day future booking for tennis', async () => {
      const now = Date.now();
      const dto: CreateBookingDto = {
        ...createBookingDto,
        startTime: new Date(now + 3_600_000),
        endTime: new Date(now + 7_200_000),
      };
      const createdBooking = {
        id: 'booking-1',
        user: { id: 'user-1' },
        resource: { id: 'resource-1' },
        startTime: dto.startTime,
        endTime: dto.endTime,
      } as unknown as Booking;

      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: true, message: 'Available' });
      jest.spyOn(resourceService, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'tennis' } as Resource);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 'user-1', role: UserRole.RESIDENT } as User);
      jest.spyOn(bookingRepository, 'create').mockReturnValue(createdBooking);
      jest.spyOn(bookingRepository, 'save').mockResolvedValue(createdBooking);

      const result = await service.create(dto, 'user-1', UserRole.RESIDENT, ORG_ID);
      expect(result).toMatchObject({
        message: 'Booking created successfully',
        booking: {
          id: 'booking-1',
          user: { id: 'user-1' },
          resource: { id: 'resource-1' },
          startTime: dto.startTime.toISOString(),
          endTime: dto.endTime.toISOString(),
        },
      });
    });

    it('throws when endTime is before startTime', async () => {
      const dto: CreateBookingDto = {
        ...createBookingDto,
        startTime: new Date('2026-06-10T15:00:00.000Z'),
        endTime: new Date('2026-06-10T14:00:00.000Z'),
      };

      await expect(service.create(dto, 'user-1', UserRole.RESIDENT, ORG_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws when resource is not available', async () => {
      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: false, message: 'Not available' });
      jest.spyOn(resourceService, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'hall' } as Resource);

      await expect(service.create(createBookingDto, 'user-1', UserRole.RESIDENT, ORG_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when non-admin sets bookedOnBehalf', async () => {
      await expect(
        service.create({ ...createBookingDto, bookedOnBehalf: 'Family Event' }, 'user-1', UserRole.RESIDENT, ORG_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createBatch', () => {
    it('creates available slots and skips conflicts with reason', async () => {
      const slotAStart = new Date('2026-06-10T12:00:00.000Z');
      const slotAEnd = new Date('2026-06-10T13:00:00.000Z');
      const slotBStart = new Date('2026-06-11T12:00:00.000Z');
      const slotBEnd = new Date('2026-06-11T13:00:00.000Z');

      jest.spyOn(resourceService, 'findOne').mockResolvedValue({
        id: 'resource-1',
        name: 'Quadra de Tenis',
        type: 'hourly',
      } as Resource);
      jest.spyOn(service, 'checkAvailability')
        .mockResolvedValueOnce({ available: true, message: 'Available' })
        .mockResolvedValueOnce({ available: false, message: 'Resource already booked' });
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 'user-1',
        apartment: '201',
        block: 2,
      } as User);
      jest.spyOn(bookingRepository, 'create').mockReturnValue({
        id: 'booking-1',
      } as Booking);
      jest.spyOn(bookingRepository, 'save').mockResolvedValue({ id: 'booking-1' } as Booking);
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue({
        id: 'booking-1',
        startTime: slotAStart,
        endTime: slotAEnd,
        bookedOnBehalf: undefined,
        needTablesAndChairs: false,
        user: { id: 'user-1', apartment: '201', block: 2 },
        resource: { id: 'resource-1', name: 'Quadra de Tenis', type: 'hourly' },
      } as unknown as Booking);

      const result = await service.createBatch(
        {
          resourceId: 'resource-1',
          slots: [
            { startTime: slotAStart, endTime: slotAEnd },
            { startTime: slotBStart, endTime: slotBEnd },
          ],
        },
        'user-1',
        UserRole.RESIDENT,
        ORG_ID,
      );

      expect(result.summary).toEqual({ requested: 2, created: 1, skipped: 1 });
      expect(result.created).toHaveLength(1);
      expect(result.skipped).toEqual([
        {
          startTime: slotBStart.toISOString(),
          endTime: slotBEnd.toISOString(),
          reason: 'Resource already booked',
        },
      ]);
    });

    it('rejects batch booking for non-hourly resources', async () => {
      jest.spyOn(resourceService, 'findOne').mockResolvedValue({
        id: 'resource-1',
        type: 'daily',
      } as Resource);

      await expect(
        service.createBatch(
          {
            resourceId: 'resource-1',
            slots: [{ startTime: new Date('2026-06-10T12:00:00.000Z'), endTime: new Date('2026-06-10T13:00:00.000Z') }],
          },
          'user-1',
          UserRole.RESIDENT,
          ORG_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('applies date range filters and maps paginated response as ISO UTC', async () => {
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
        where: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([bookings, 1]),
      };

      bookingRepository.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder as any);

      const result = await service.findAll(ORG_ID, 1, 10, 'startTime', 'ASC', '2026-06-10', '2026-06-11');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('booking.startTime >= :startDate', {
        startDate: new Date('2026-06-10T00:00:00.000Z'),
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('booking.startTime <= :endDate', {
        endDate: new Date('2026-06-11T23:59:59.999Z'),
      });
      expect(result).toEqual({
        data: [
          {
            id: 'booking-1',
            resourceId: 'resource-1',
            resourceName: 'Party Hall',
            resourceType: 'hall',
            startTime: '2026-06-10T12:00:00.000Z',
            endTime: '2026-06-10T15:00:00.000Z',
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
    it('returns paginated user bookings serialized as ISO UTC', async () => {
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

      const result = await service.findByUser('user-1', ORG_ID, 1, 10, 'startTime', 'ASC');

      expect(result).toEqual({
        data: [
          {
            id: 'booking-1',
            resourceId: 'resource-1',
            resourceName: 'Party Hall',
            resourceType: 'hall',
            startTime: '2026-06-10T12:00:00.000Z',
            endTime: '2026-06-10T15:00:00.000Z',
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
      expect(result.data[0].startTime).toMatch(/Z$/);
      expect(result.data[0].endTime).toMatch(/Z$/);
    });

    it('keeps UTC instant for a Sao Paulo 08:00 booking and serializes as 11:00Z', async () => {
      const bookings = [
        {
          id: 'booking-2',
          startTime: new Date('2026-06-10T11:00:00.000Z'),
          endTime: new Date('2026-06-10T12:00:00.000Z'),
          needTablesAndChairs: false,
          user: { id: 'user-1', apartment: '101', block: 1 },
          resource: { id: 'resource-1', name: 'Court 1', type: 'tennis' },
        },
      ];

      jest.spyOn(bookingRepository, 'findAndCount').mockResolvedValue([bookings as Booking[], 1]);

      const result = await service.findByUser('user-1', ORG_ID, 1, 10, 'startTime', 'ASC');
      expect(result.data[0].startTime).toBe('2026-06-10T11:00:00.000Z');
    });
  });

  describe('remove', () => {
    it('removes booking when requester is owner', async () => {
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue({ id: 'booking-1', user: { id: 'user-1' } } as Booking);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 'user-1', role: UserRole.RESIDENT } as User);
      jest.spyOn(bookingRepository, 'remove').mockResolvedValue({ id: 'booking-1' } as Booking);

      await expect(service.remove('booking-1', 'user-1', ORG_ID)).resolves.toEqual({
        message: 'Booking removed successfully',
      });
    });

    it('throws NotFound when booking does not exist', async () => {
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('missing-booking', 'user-1', ORG_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkAvailability', () => {
    it('throws when resource does not exist', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.checkAvailability(
          'resource-1',
          new Date('2026-06-10T12:00:00.000Z'),
          new Date('2026-06-10T15:00:00.000Z'),
          { organizationId: ORG_ID },
        ),
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
        { organizationId: ORG_ID },
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
        { userId: 'user-1', organizationId: ORG_ID },
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('booking.startTime < :endOfLocalDayUtcExclusive', {
        endOfLocalDayUtcExclusive: new Date('2026-06-11T03:00:00.000Z'),
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('booking.endTime > :startOfLocalDayUtc', {
        startOfLocalDayUtc: new Date('2026-06-10T03:00:00.000Z'),
      });
      expect(result.available).toBe(false);
      expect(result.message).toContain('more than 2 total tennis hours');
    });

    it('counts overlap with day window for tennis cap', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'tennis' } as Resource);
      jest.spyOn(bookingRepository, 'find').mockResolvedValue([]);

      const queryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'booking-1',
            // 1h overlap in the target Sao Paulo local day (03:00Z -> 04:00Z)
            startTime: new Date('2026-06-10T02:00:00.000Z'),
            endTime: new Date('2026-06-10T04:00:00.000Z'),
          },
        ]),
      };
      bookingRepository.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder as any);

      const result = await service.checkAvailability(
        'resource-1',
        new Date('2026-06-10T10:00:00.000Z'),
        new Date('2026-06-10T11:30:00.000Z'),
        { userId: 'user-1', organizationId: ORG_ID },
      );

      expect(result.available).toBe(false);
      expect(result.message).toContain('more than 2 total tennis hours');
    });

    it('allows tennis booking that crosses UTC date but stays on same Sao Paulo local day', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'tennis' } as Resource);
      jest.spyOn(bookingRepository, 'find').mockResolvedValue([]);

      const queryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      bookingRepository.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder as any);

      const result = await service.checkAvailability(
        'resource-1',
        new Date('2026-03-03T22:00:00.000Z'),
        new Date('2026-03-03T23:00:00.000Z'),
        { userId: 'user-1', organizationId: ORG_ID },
      );

      expect(result.available).toBe(true);
    });

    it('rejects tennis booking when start and end fall on different Sao Paulo local days', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'tennis' } as Resource);

      await expect(
        service.checkAvailability(
          'resource-1',
          new Date('2026-03-04T02:30:00.000Z'),
          new Date('2026-03-04T03:30:00.000Z'),
          { userId: 'user-1', organizationId: ORG_ID },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid dates in time range validation', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'tennis' } as Resource);

      await expect(
        service.checkAvailability(
          'resource-1',
          new Date('invalid-date'),
          new Date('2026-03-03T23:00:00.000Z'),
          { userId: 'user-1', organizationId: ORG_ID },
        ),
      ).rejects.toThrow(BadRequestException);
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
          ORG_ID,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks update when endTime is before startTime', async () => {
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
          {
            startTime: new Date('2026-06-11T12:00:00.000Z'),
            endTime: new Date('2026-06-11T11:00:00.000Z'),
          },
          'owner-1',
          UserRole.RESIDENT,
          ORG_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not allow mass assignment of userId during update', async () => {
      const booking = {
        id: 'booking-1',
        user: { id: 'owner-1' },
        resource: { id: 'resource-1' },
        startTime: new Date('2026-06-10T10:00:00.000Z'),
        endTime: new Date('2026-06-10T11:00:00.000Z'),
        needTablesAndChairs: false,
      } as unknown as Booking;
      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(booking);
      jest.spyOn(resourceService, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'hall' } as Resource);
      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: true, message: 'Available' });
      jest.spyOn(bookingRepository, 'save').mockResolvedValue(booking);

      await service.update(
        'booking-1',
        {
          startTime: new Date('2026-06-11T10:00:00.000Z'),
          endTime: new Date('2026-06-11T11:00:00.000Z'),
          userId: 'attacker-user',
        } as Partial<CreateBookingDto>,
        'owner-1',
        UserRole.RESIDENT,
        ORG_ID,
      );

      expect(booking.user.id).toBe('owner-1');
    });

    it('throws ForbiddenException when non-admin sets bookedOnBehalf during update', async () => {
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
          { bookedOnBehalf: 'Family Event' },
          'owner-1',
          UserRole.RESIDENT,
          ORG_ID,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('serializes updated booking timestamps as ISO UTC', async () => {
      const booking = {
        id: 'booking-1',
        user: { id: 'owner-1' },
        resource: { id: 'resource-1' },
        startTime: new Date('2026-06-10T10:00:00.000Z'),
        endTime: new Date('2026-06-10T11:00:00.000Z'),
        needTablesAndChairs: false,
      } as unknown as Booking;

      jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(booking);
      jest.spyOn(resourceService, 'findOne').mockResolvedValue({ id: 'resource-1', type: 'hall' } as Resource);
      jest.spyOn(service, 'checkAvailability').mockResolvedValue({ available: true, message: 'Available' });
      jest.spyOn(bookingRepository, 'save').mockResolvedValue(booking);

      const result = await service.update(
        'booking-1',
        {
          startTime: new Date('2026-06-11T10:00:00.000Z'),
          endTime: new Date('2026-06-11T11:00:00.000Z'),
        },
        'owner-1',
        UserRole.RESIDENT,
        ORG_ID,
      );

      expect(result.booking.startTime).toBe('2026-06-11T10:00:00.000Z');
      expect(result.booking.endTime).toBe('2026-06-11T11:00:00.000Z');
    });
  });

  describe('getReservedTimes', () => {
    it('queries tennis reservations using Sao Paulo local day overlap window', async () => {
      jest.spyOn(resourceRepository, 'find').mockResolvedValue([{ id: 'resource-1', type: 'tennis' } as Resource]);

      const bookings = [
        {
          id: 'booking-1',
          startTime: new Date('2026-03-03T22:00:00.000Z'),
          endTime: new Date('2026-03-03T23:00:00.000Z'),
        },
      ] as Booking[];

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(bookings),
      };
      bookingRepository.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder as any);

      const result = await service.getReservedTimes(ORG_ID, 'tennis', '2026-03-03');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('booking.startTime < :endOfLocalDayUtcExclusive', {
        endOfLocalDayUtcExclusive: new Date('2026-03-04T03:00:00.000Z'),
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('booking.endTime > :startOfLocalDayUtc', {
        startOfLocalDayUtc: new Date('2026-03-03T03:00:00.000Z'),
      });
      expect(result).toEqual({
        reservedTimes: [
          {
            startTime: '2026-03-03T22:00:00.000Z',
            endTime: '2026-03-03T23:00:00.000Z',
            userId: null,
            userApartment: null,
            userBlock: null,
            bookedOnBehalf: null,
          },
        ],
      });
    });

    it('throws when date format is invalid for non-grill resources', async () => {
      jest.spyOn(resourceRepository, 'find').mockResolvedValue([{ id: 'resource-1', type: 'tennis' } as Resource]);

      await expect(service.getReservedTimes(ORG_ID, 'tennis', '03/03/2026')).rejects.toThrow(BadRequestException);
  });
});
});
