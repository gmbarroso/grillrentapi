import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { ResourceService } from '../../resource/services/resource.service';
import { Booking } from '../entities/booking.entity';
import { User, UserRole } from '../../user/entities/user.entity';
import { Resource } from '../../resource/entities/resource.entity';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Resource)
    private readonly resourceRepository: Repository<Resource>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly resourceService: ResourceService,
  ) {}

  async create(createBookingDto: CreateBookingDto, userId: string) {
    this.logger.log(`Creating booking for user ID: ${userId}`);

    const { resourceId, startTime, endTime } = createBookingDto;

    // Verificar se a reserva está sendo feita para dias futuros
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Zerar horas, minutos, segundos e milissegundos
    if (new Date(startTime) <= currentDate) {
      this.logger.warn(`Cannot create booking for today or a past date: ${startTime}`);
      throw new BadRequestException('Cannot create booking for today or a past date');
    }

    // Verificar disponibilidade
    const isAvailable = await this.checkAvailability(resourceId, new Date(startTime), new Date(endTime));

    if (!isAvailable.available) {
      this.logger.warn(`Resource ID: ${resourceId} is not available from ${startTime} to ${endTime}`);
      throw new BadRequestException(isAvailable.message);
    }

    // Verificar se o recurso existe
    const resource = await this.resourceService.findOne(resourceId);
    if (!resource) {
      this.logger.warn(`Resource not found: ${resourceId}`);
      throw new BadRequestException('Resource not found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new BadRequestException('Invalid user');
    }

    const booking = this.bookingRepository.create({ ...createBookingDto, user, resource });
    await this.bookingRepository.save(booking);
    this.logger.log(`Booking created successfully: ${booking.id}`);

    return { message: 'Booking created successfully', booking };
  }

  async checkAvailability(resourceId: string, startTime: Date, endTime: Date) {
    this.logger.log(`Checking for existing bookings for resource ID: ${resourceId} from ${startTime} to ${endTime}`);
    const existingBookings = await this.bookingRepository.find({
      where: [
        { resourceId, startTime: LessThanOrEqual(endTime), endTime: MoreThanOrEqual(startTime) },
      ],
      relations: ['user'],
    });

    if (existingBookings.length > 0) {
      const existingBooking = existingBookings[0];
      this.logger.warn(`There is already a booking for resource ID: ${resourceId} at the specified time by apartment ${existingBooking.user.apartment}`);
      return { available: false, message: `Resource is already booked by apartment ${existingBooking.user.apartment} at the specified time` };
    }

    this.logger.log(`Resource ID: ${resourceId} is available from ${startTime} to ${endTime}`);
    return { available: true, message: 'Available' };
  }

  async findByUser(userId: string) {
    this.logger.log(`Fetching bookings for user ID: ${userId}`);
    const bookings = await this.bookingRepository.find({ where: { user: { id: userId } }, relations: ['resource', 'user'] });
    return bookings.map(booking => ({
      id: booking.id,
      resourceId: booking.resource.id,
      resourceName: booking.resource.name,
      startTime: booking.startTime,
      endTime: booking.endTime,
      userId: booking.user.id,
      userApartment: booking.user.apartment,
    }));
  }

  async findAll() {
    this.logger.log('Fetching all bookings');
    const bookings = await this.bookingRepository.find({ relations: ['resource', 'user'] });
    return bookings.map(booking => ({
      id: booking.id,
      resourceId: booking.resource.id,
      resourceName: booking.resource.name,
      startTime: booking.startTime,
      endTime: booking.endTime,
      userId: booking.user.id,
      userApartment: booking.user.apartment,
    }));
  }

  async remove(bookingId: string, userId: string) {
    this.logger.log(`Removing booking ID: ${bookingId} by user ID: ${userId}`);
    
    const booking = await this.bookingRepository.findOne({ where: { id: bookingId }, relations: ['user'] });
    if (!booking) {
      this.logger.warn(`Booking not found: ${bookingId}`);
      throw new NotFoundException('Booking not found');
    }
  
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }
  
    if (user.role !== UserRole.ADMIN && booking.user.id !== userId) {
      this.logger.warn(`User ID: ${userId} is not authorized to remove booking ID: ${bookingId}`);
      throw new BadRequestException('You are not authorized to remove this booking');
    }
  
    await this.bookingRepository.remove(booking);
    this.logger.log(`Booking removed successfully: ${bookingId}`);
    return { message: 'Booking removed successfully' };
  }
}
