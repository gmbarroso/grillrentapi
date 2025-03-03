import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from '../src/api/booking/services/booking.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../src/api/booking/entities/booking.entity';
import { User, UserRole } from '../src/api/user/entities/user.entity';
import { Resource } from '../src/api/resource/entities/resource.entity';
import { Repository } from 'typeorm';

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepository: Repository<Booking>;
  let userRepository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: getRepositoryToken(Booking),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Resource),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    bookingRepository = module.get<Repository<Booking>>(getRepositoryToken(Booking));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should allow admin to remove any booking', async () => {
    const adminUser = { id: 'admin-id', role: UserRole.ADMIN } as User;
    const booking = { id: 'booking-id', user: { id: 'user-id' } } as Booking;

    jest.spyOn(userRepository, 'findOne').mockResolvedValue(adminUser);
    jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(booking);
    jest.spyOn(bookingRepository, 'remove').mockResolvedValue(undefined);

    await expect(service.remove('booking-id', 'admin-id')).resolves.toEqual({ message: 'Booking removed successfully' });
  });

  it('should allow resident to remove their own booking', async () => {
    const residentUser = { id: 'resident-id', role: UserRole.RESIDENT } as User;
    const booking = { id: 'booking-id', user: { id: 'resident-id' } } as Booking;

    jest.spyOn(userRepository, 'findOne').mockResolvedValue(residentUser);
    jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(booking);
    jest.spyOn(bookingRepository, 'remove').mockResolvedValue(undefined);

    await expect(service.remove('booking-id', 'resident-id')).resolves.toEqual({ message: 'Booking removed successfully' });
  });

  it('should not allow resident to remove another user\'s booking', async () => {
    const residentUser = { id: 'resident-id', role: UserRole.RESIDENT } as User;
    const booking = { id: 'booking-id', user: { id: 'other-user-id' } } as Booking;

    jest.spyOn(userRepository, 'findOne').mockResolvedValue(residentUser);
    jest.spyOn(bookingRepository, 'findOne').mockResolvedValue(booking);

    await expect(service.remove('booking-id', 'resident-id')).rejects.toThrow('You are not authorized to remove this booking');
  });
});
