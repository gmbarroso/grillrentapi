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

  async create(createBookingDto: CreateBookingDto, userId: string, userRole: string) {
    this.logger.log(`Creating booking for user ID: ${userId}`);

    const { resourceId, startTime, endTime, needTablesAndChairs, bookedOnBehalf } = createBookingDto;

    if (bookedOnBehalf && userRole !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${userId} is not authorized to set bookedOnBehalf`);
      throw new UnauthorizedException('Only admins can set bookedOnBehalf');
    }

    if (bookedOnBehalf && bookedOnBehalf.length > 50) {
      this.logger.warn(`Invalid value for bookedOnBehalf: ${bookedOnBehalf}`);
      throw new BadRequestException('bookedOnBehalf must be a string with a maximum length of 50 characters');
    }

    this.logger.log(`Checking if booking is valid for resource ID: ${resourceId}, start time: ${startTime}, end time: ${endTime}`);

    // Verificar se o horário de início e término são iguais
    if (new Date(startTime).getTime() === new Date(endTime).getTime()) {
      this.logger.warn(`Start time and end time cannot be the same: ${startTime}`);
      throw new BadRequestException('Start time and end time cannot be the same');
    }

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
      user: { id: user.id } as User, 
      resource: { id: resource.id } as Resource, 
      startTime: new Date(startTime).toISOString(), 
      endTime: new Date(endTime).toISOString(),
      needTablesAndChairs,
      bookedOnBehalf: userRole === UserRole.ADMIN ? bookedOnBehalf || undefined : undefined,
    });
    await this.bookingRepository.save(booking);
    this.logger.log(`Booking created successfully: ${booking.id}`);
    this.logger.log(`Booking created successfully: ${booking.id}, user: ${user.id}, resource: ${resource.id}, start time: ${startTime}, end time: ${endTime}, needTablesAndChairs: ${needTablesAndChairs}`);

    return { message: 'Booking created successfully', booking };
  }

  async update(bookingId: string, updateBookingDto: Partial<CreateBookingDto>, userId: string, userRole: string) {
    this.logger.log(`Updating booking ID: ${bookingId} by user ID: ${userId}`);

    const booking = await this.bookingRepository.findOne({ where: { id: bookingId } });
    if (!booking) {
      this.logger.warn(`Booking not found: ${bookingId}`);
      throw new NotFoundException('Booking not found');
    }

    if (updateBookingDto.bookedOnBehalf && userRole !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${userId} is not authorized to set bookedOnBehalf`);
      throw new UnauthorizedException('Only admins can set bookedOnBehalf');
    }

    if (updateBookingDto.bookedOnBehalf && updateBookingDto.bookedOnBehalf.length > 50) {
      this.logger.warn(`Invalid value for bookedOnBehalf: ${updateBookingDto.bookedOnBehalf}`);
      throw new BadRequestException('bookedOnBehalf must be a string with a maximum length of 50 characters');
    }

    Object.assign(booking, {
      ...updateBookingDto,
      bookedOnBehalf: userRole === UserRole.ADMIN ? updateBookingDto.bookedOnBehalf : booking.bookedOnBehalf,
    });

    await this.bookingRepository.save(booking);
    this.logger.log(`Booking updated successfully: ${booking.id}`);
    return { message: 'Booking updated successfully', booking };
  }

  async checkAvailability(resourceId: string, startTime: Date, endTime: Date) {
    this.logger.log(`Checking for existing bookings for resource ID: ${resourceId} from ${startTime} to ${endTime}`);
    
    const resource = await this.resourceRepository.findOne({ where: { id: resourceId } });
    if (!resource) {
      this.logger.warn(`Resource not found: ${resourceId}`);
      throw new BadRequestException('Resource not found');
    }
  
    const existingBookings = await this.bookingRepository.find({
      where: { resource: { id: resourceId } },
      relations: ['user'],
    });
  
    // Verificação específica para o tipo "grill"
    if (resource.type === 'grill') {
      const bookingDate = startTime.toISOString().split('T')[0];
      const hasBookingOnSameDay = existingBookings.some(booking => {
        const existingBookingDate = new Date(booking.startTime).toISOString().split('T')[0];
        return existingBookingDate === bookingDate;
      });
  
      if (hasBookingOnSameDay) {
        this.logger.warn(`Resource ID: ${resourceId} (type: grill) already has a booking on ${bookingDate}`);
        return { available: false, message: `Resource of type "grill" is already booked on ${bookingDate}` };
      }
    }
  
    // Verificação geral para sobreposição de horários
    for (const booking of existingBookings) {
      const existingStartTime = new Date(booking.startTime);
      const existingEndTime = new Date(booking.endTime);
  
      if (
        !(existingEndTime <= startTime || existingStartTime >= endTime)
      ) {
        this.logger.warn(`Resource ID: ${resourceId} is not available from ${startTime} to ${endTime}`);
        return { available: false, message: `Resource is already booked by apartment ${booking.user.apartment} at the specified time` };
      }
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
        bookedOnBehalf: booking.bookedOnBehalf,
        needTablesAndChairs: booking.needTablesAndChairs, // Incluído na resposta
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async findAll(page: number = 1, limit: number = 10, sort: string = 'startTime', order: 'ASC' | 'DESC' = 'ASC') {
    this.logger.log('Fetching all bookings with pagination and sorting');

    const validSortColumns = ['startTime', 'endTime', 'resourceType', 'userApartment'];
    if (!validSortColumns.includes(sort)) {
      throw new BadRequestException(`Invalid sort column: ${sort}`);
    }

    const queryBuilder = this.bookingRepository.createQueryBuilder('booking')
      .leftJoinAndSelect('booking.resource', 'resource')
      .leftJoinAndSelect('booking.user', 'user')
      .take(limit)
      .skip((page - 1) * limit);

    if (sort === 'resourceType') {
      queryBuilder.orderBy('resource.type', order);
    } else if (sort === 'userApartment') {
      queryBuilder.orderBy('user.apartment', order);
    } else {
      queryBuilder.orderBy(`booking.${sort}`, order);
    }

    const [bookings, total] = await queryBuilder.getManyAndCount();

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
        bookedOnBehalf: booking.bookedOnBehalf,
        needTablesAndChairs: booking.needTablesAndChairs, // Incluído na resposta
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

  async getReservedTimes(resourceType: string, date?: string) {
    this.logger.log(`Fetching reserved times for resourceType: ${resourceType}${date ? ` on date: ${date}` : ''}`);

    const resources = await this.resourceRepository.find({ where: { type: resourceType } });
    if (resources.length === 0) {
      this.logger.warn(`No resources found for type: ${resourceType}`);
      throw new BadRequestException(`No resources found for type: ${resourceType}`);
    }

    if (resourceType === 'grill') {
      const bookings = await this.bookingRepository.find({
        where: { resource: { type: resourceType } },
        relations: ['resource'],
      });

      const reservedDays = Array.from(
        new Set(bookings.map(booking => new Date(booking.startTime).toISOString().split('T')[0]))
      );
      return { reservedDays };
    }

    if (!date) {
      this.logger.warn('Date parameter is required for non-grill resources');
      throw new BadRequestException('Date parameter is required for non-grill resources');
    }

    const startOfDay = new Date(`${date}T00:00:00Z`);
    const endOfDay = new Date(`${date}T23:59:59Z`);

    const bookings = await this.bookingRepository.find({
      where: {
        resource: { type: resourceType },
        startTime: MoreThanOrEqual(startOfDay),
        endTime: LessThanOrEqual(endOfDay),
      },
      relations: ['resource'],
    });

    const reservedTimes = bookings.map(booking => ({
      startTime: booking.startTime,
      endTime: booking.endTime,
    }));

    return { reservedTimes };
  }
}
