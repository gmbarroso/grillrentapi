import { Injectable, NotFoundException, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, FindManyOptions } from 'typeorm';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { ResourceService } from '../../resource/services/resource.service';
import { Booking } from '../entities/booking.entity';
import { User, UserRole } from '../../user/entities/user.entity';
import { Resource } from '../../resource/entities/resource.entity';
import { AuthService } from '../../../shared/auth/services/auth.service';

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
    private readonly authService: AuthService,
  ) {}

  async create(createBookingDto: CreateBookingDto, userId: string) {
    this.logger.log(`Creating booking for user ID: ${userId}`);

    const { resourceId, startTime, endTime, needTablesAndChairs } = createBookingDto;

    this.logger.log(`Checking if booking is valid for resource ID: ${resourceId}, start time: ${startTime}, end time: ${endTime}`);

    // Verificar se a reserva está sendo feita para dias futuros
    const currentDate = new Date();
    currentDate.setUTCHours(0, 0, 0, 0);
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

    const booking = this.bookingRepository.create({ 
      ...createBookingDto, 
      user, 
      resource, 
      startTime: new Date(startTime).toISOString(), 
      endTime: new Date(endTime).toISOString(),
      needTablesAndChairs
    });
    await this.bookingRepository.save(booking);
    this.logger.log(`Booking created successfully: ${booking.id}`);
    this.logger.log(`Booking created successfully: ${booking.id}, user: ${user.id}, resource: ${resource.id}, start time: ${startTime}, end time: ${endTime}, needTablesAndChairs: ${needTablesAndChairs}`);

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

    console.log(existingBookings)

    if (existingBookings.length > 0) {
      const existingBooking = existingBookings[0];
      this.logger.warn(`There is already a booking for resource ID: ${resourceId} at the specified time by apartment ${existingBooking.user.apartment}`);
      return { available: false, message: `Resource is already booked by apartment ${existingBooking.user.apartment} at the specified time` };
    }

    this.logger.log(`Resource ID: ${resourceId} is available from ${startTime} to ${endTime}`);
    return { available: true, message: 'Available' };
  }

  async findByUser(userId: string, page: number = 1, limit: number = 10, sort: string = 'startTime', order: 'ASC' | 'DESC' = 'ASC') {
    this.logger.log(`Fetching bookings for user ID: ${userId} with pagination and sorting`);
    const options: FindManyOptions<Booking> = {
      where: { user: { id: userId } },
      relations: ['resource', 'user'],
      take: limit,
      skip: (page - 1) * limit,
      order: {
        [sort]: order,
      },
    };
    const [bookings, total] = await this.bookingRepository.findAndCount(options);
    return {
      data: bookings.map(booking => ({
        id: booking.id,
        resourceId: booking.resource.id,
        resourceName: booking.resource.name,
        resourceType: booking.resource.type,
        startTime: booking.startTime,
        endTime: booking.endTime,
        userId: booking.user.id,
        userApartment: booking.user.apartment,
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async findAll(page: number = 1, limit: number = 10, sort: string = 'startTime', order: 'ASC' | 'DESC' = 'ASC') {
    this.logger.log('Fetching all bookings with pagination and sorting');
    const options: FindManyOptions<Booking> = {
      relations: ['resource', 'user'],
      take: limit,
      skip: (page - 1) * limit,
      order: {
        [sort]: order,
      },
    };
    const [bookings, total] = await this.bookingRepository.findAndCount(options);
    return {
      data: bookings.map(booking => ({
        id: booking.id,
        resourceId: booking.resource.id,
        resourceName: booking.resource.name,
        resourceType: booking.resource.type,
        startTime: booking.startTime,
        endTime: booking.endTime,
        userId: booking.user.id,
        userApartment: booking.user.apartment,
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
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
