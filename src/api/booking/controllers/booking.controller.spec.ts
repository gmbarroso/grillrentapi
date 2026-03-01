import { Test, TestingModule } from '@nestjs/testing';
import { BookingController } from './booking.controller';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';

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
            update: jest.fn(),
            findAll: jest.fn(),
            findByUser: jest.fn(),
            remove: jest.fn(),
            checkAvailability: jest.fn(),
            getReservedTimes: jest.fn(),
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

  it('creates booking using authenticated user id and role', async () => {
    const dto: CreateBookingDto = {
      resourceId: 'resource-1',
      userId: 'ignored-by-controller',
      startTime: new Date('2026-06-10T12:00:00.000Z'),
      endTime: new Date('2026-06-10T15:00:00.000Z'),
      needTablesAndChairs: true,
    };
    const req = { user: { id: 'user-1', role: UserRole.ADMIN } };
    const payload = { message: 'Booking created successfully', booking: { id: 'booking-1' } };
    service.create.mockResolvedValue(payload as any);

    await expect(controller.create(dto, req as any)).resolves.toEqual(payload);
    expect(service.create).toHaveBeenCalledWith(dto, 'user-1', UserRole.ADMIN);
  });

  it('forwards findAll query params with defaults', async () => {
    const payload = { data: [], total: 0, page: 1, lastPage: 0 };
    service.findAll.mockResolvedValue(payload);

    await expect(controller.findAll()).resolves.toEqual(payload);
    expect(service.findAll).toHaveBeenCalledWith(1, 10, 'startTime', 'ASC', undefined, undefined);
  });

  it('forwards findByUser query params', async () => {
    const payload = { data: [], total: 0, page: 1, lastPage: 0 };
    service.findByUser.mockResolvedValue(payload as any);

    await expect(controller.findByUser('user-1', 2, 20, 'endTime', 'DESC')).resolves.toEqual(payload);
    expect(service.findByUser).toHaveBeenCalledWith('user-1', 2, 20, 'endTime', 'DESC');
  });

  it('removes booking with authenticated user id', async () => {
    const payload = { message: 'Booking removed successfully' };
    service.remove.mockResolvedValue(payload);

    await expect(controller.remove('booking-1', { user: { id: 'user-1' } } as any)).resolves.toEqual(payload);
    expect(service.remove).toHaveBeenCalledWith('booking-1', 'user-1');
  });

  it('checks availability with Date conversion', async () => {
    const payload = { available: true, message: 'Available' };
    service.checkAvailability.mockResolvedValue(payload);
    const req = { user: { id: 'user-1' } };

    await expect(
      controller.checkAvailability('resource-1', '2026-06-10T12:00:00.000Z', '2026-06-10T15:00:00.000Z', req as any),
    ).resolves.toEqual(payload);

    expect(service.checkAvailability).toHaveBeenCalledWith(
      'resource-1',
      new Date('2026-06-10T12:00:00.000Z'),
      new Date('2026-06-10T15:00:00.000Z'),
      { userId: 'user-1' },
    );
  });
});
