import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { ResourceService } from '../../resource/services/resource.service';
import { Booking } from '../entities/booking.entity';
import { User, UserRole } from '../../user/entities/user.entity';
import { Resource } from '../../resource/entities/resource.entity';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private static readonly SAO_PAULO_UTC_OFFSET_HOURS = 3;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Resource)
    private readonly resourceRepository: Repository<Resource>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly resourceService: ResourceService,
  ) {}

  async create(createBookingDto: CreateBookingDto, userId: string, userRole: string, organizationId: string) {
    this.logger.log(`Creating booking for user ID: ${userId}`);

    const { resourceId, startTime, endTime, needTablesAndChairs, bookedOnBehalf } = createBookingDto;

    if (bookedOnBehalf && userRole !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${userId} is not authorized to set bookedOnBehalf`);
      throw new ForbiddenException('Only admins can set bookedOnBehalf');
    }

    if (bookedOnBehalf && bookedOnBehalf.length > 50) {
      this.logger.warn(`Invalid value for bookedOnBehalf: ${bookedOnBehalf}`);
      throw new BadRequestException('bookedOnBehalf must be a string with a maximum length of 50 characters');
    }

    this.logger.log(`Checking if booking is valid for resource ID: ${resourceId}, start time: ${startTime}, end time: ${endTime}`);

    const nextStartTime = new Date(startTime);
    const nextEndTime = new Date(endTime);
    this.validateTimeRange(nextStartTime, nextEndTime, 'creating');

    const resource = await this.resourceService.findOne(resourceId, organizationId);
    if (!resource) {
      this.logger.warn(`Resource not found: ${resourceId}`);
      throw new BadRequestException('Resource not found');
    }
    this.validateStartTimePolicy(resource.type, nextStartTime, 'create');

    // Verificar disponibilidade
    const isAvailable = await this.checkAvailability(resourceId, nextStartTime, nextEndTime, { userId, organizationId });

    if (!isAvailable.available) {
      this.logger.warn(`Resource ID: ${resourceId} is not available from ${startTime} to ${endTime}`);
      throw new BadRequestException(isAvailable.message);
    }

    const user = await this.userRepository.findOne({ where: { id: userId, organizationId } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new BadRequestException('Invalid user');
    }

    const booking = this.bookingRepository.create({
      user: { id: user.id } as User,
      resource: { id: resource.id } as Resource,
      startTime: nextStartTime,
      endTime: nextEndTime,
      organizationId,
      needTablesAndChairs,
      bookedOnBehalf: userRole === UserRole.ADMIN ? bookedOnBehalf || undefined : undefined,
    });
    await this.bookingRepository.save(booking);
    this.logger.log(`Booking created successfully: ${booking.id}`);
    this.logger.log(`Booking created successfully: ${booking.id}, user: ${user.id}, resource: ${resource.id}, start time: ${startTime}, end time: ${endTime}, needTablesAndChairs: ${needTablesAndChairs}`);

    return { message: 'Booking created successfully', booking: this.serializeBookingTimestampFields(booking) };
  }

  async update(
    bookingId: string,
    updateBookingDto: Partial<CreateBookingDto>,
    userId: string,
    userRole: string,
    organizationId: string,
  ) {
    this.logger.log(`Updating booking ID: ${bookingId} by user ID: ${userId}`);

    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId, organizationId },
      relations: ['user', 'resource'],
    });
    if (!booking) {
      this.logger.warn(`Booking not found: ${bookingId}`);
      throw new NotFoundException('Booking not found');
    }

    if (userRole !== UserRole.ADMIN && booking.user.id !== userId) {
      this.logger.warn(`User ID: ${userId} is not authorized to update booking ID: ${bookingId}`);
      throw new ForbiddenException('You are not authorized to update this booking');
    }

    if (updateBookingDto.bookedOnBehalf && userRole !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${userId} is not authorized to set bookedOnBehalf`);
      throw new ForbiddenException('Only admins can set bookedOnBehalf');
    }

    if (updateBookingDto.bookedOnBehalf && updateBookingDto.bookedOnBehalf.length > 50) {
      this.logger.warn(`Invalid value for bookedOnBehalf: ${updateBookingDto.bookedOnBehalf}`);
      throw new BadRequestException('bookedOnBehalf must be a string with a maximum length of 50 characters');
    }

    const nextStartTime = updateBookingDto.startTime ? new Date(updateBookingDto.startTime) : new Date(booking.startTime);
    const nextEndTime = updateBookingDto.endTime ? new Date(updateBookingDto.endTime) : new Date(booking.endTime);
    const nextResourceId = updateBookingDto.resourceId ?? booking.resource.id;

    this.validateTimeRange(nextStartTime, nextEndTime, 'updating');

    const resource = await this.resourceService.findOne(nextResourceId, organizationId);
    if (!resource) {
      this.logger.warn(`Resource not found: ${nextResourceId}`);
      throw new BadRequestException('Resource not found');
    }
    this.validateStartTimePolicy(resource.type, nextStartTime, 'update');

    const isAvailable = await this.checkAvailability(nextResourceId, nextStartTime, nextEndTime, {
      userId: booking.user.id,
      organizationId,
      excludeBookingId: bookingId,
    });
    if (!isAvailable.available) {
      this.logger.warn(`Resource ID: ${nextResourceId} is not available from ${nextStartTime.toISOString()} to ${nextEndTime.toISOString()}`);
      throw new BadRequestException(isAvailable.message);
    }

    booking.resource = { id: nextResourceId } as Resource;
    booking.startTime = nextStartTime;
    booking.endTime = nextEndTime;

    if (typeof updateBookingDto.needTablesAndChairs !== 'undefined') {
      booking.needTablesAndChairs = updateBookingDto.needTablesAndChairs;
    }

    if (userRole === UserRole.ADMIN && Object.prototype.hasOwnProperty.call(updateBookingDto, 'bookedOnBehalf')) {
      booking.bookedOnBehalf = updateBookingDto.bookedOnBehalf || undefined;
    }

    await this.bookingRepository.save(booking);
    this.logger.log(`Booking updated successfully: ${booking.id}`);
    return { message: 'Booking updated successfully', booking: this.serializeBookingTimestampFields(booking) };
  }

  async checkAvailability(
    resourceId: string,
    startTime: Date,
    endTime: Date,
    options: { organizationId: string; userId?: string; excludeBookingId?: string },
  ) {
    this.logger.log(`Checking for existing bookings for resource ID: ${resourceId} from ${startTime} to ${endTime}`);

    const resource = await this.resourceRepository.findOne({
      where: { id: resourceId, organizationId: options.organizationId },
    });
    if (!resource) {
      this.logger.warn(`Resource not found: ${resourceId}`);
      throw new BadRequestException('Resource not found');
    }

    this.validateTimeRange(startTime, endTime, 'checking availability for');

    if (resource.type === 'hourly') {
      this.ensureSameSaoPauloDay(startTime, endTime, 'Hourly booking');
    }
  
    const existingBookings = await this.bookingRepository.find({
      where: { resource: { id: resourceId }, organizationId: options.organizationId },
      relations: ['user'],
    });
    const filteredBookings = options?.excludeBookingId
      ? existingBookings.filter((booking) => booking.id !== options.excludeBookingId)
      : existingBookings;
  
    // Daily resources can only be booked once per day.
    if (resource.type === 'daily') {
      const [requestedDayStartUtc] = this.getSaoPauloUtcDayRangeForInstant(startTime);
      const bookingDate = requestedDayStartUtc.toISOString().split('T')[0];
      const hasBookingOnSameDay = filteredBookings.some(booking => {
        const [existingDayStartUtc] = this.getSaoPauloUtcDayRangeForInstant(new Date(booking.startTime));
        return existingDayStartUtc.getTime() === requestedDayStartUtc.getTime();
      });
  
      if (hasBookingOnSameDay) {
        this.logger.warn(`Resource ID: ${resourceId} (type: daily) already has a booking on ${bookingDate}`);
        return { available: false, message: `Resource of type "daily" is already booked on ${bookingDate}` };
      }
    }
  
    if (resource.type === 'hourly' && options?.userId) {
      const [startOfLocalDayUtc, endOfLocalDayUtcExclusive] = this.getSaoPauloUtcDayRangeForInstant(startTime);

      const userHourlyBookingsQuery = this.bookingRepository
        .createQueryBuilder('booking')
        .leftJoin('booking.resource', 'resource')
        .where('booking.userId = :userId', { userId: options.userId })
        .andWhere('booking.organizationId = :organizationId', { organizationId: options.organizationId })
        .andWhere('resource.type = :resourceType', { resourceType: 'hourly' })
        .andWhere('booking.startTime < :endOfLocalDayUtcExclusive', { endOfLocalDayUtcExclusive })
        .andWhere('booking.endTime > :startOfLocalDayUtc', { startOfLocalDayUtc });

      if (options.excludeBookingId) {
        userHourlyBookingsQuery.andWhere('booking.id != :excludeBookingId', { excludeBookingId: options.excludeBookingId });
      }

      const userHourlyBookings = await userHourlyBookingsQuery.getMany();
      const totalBookedHours = userHourlyBookings.reduce((sum, booking) => {
        const bookingStart = new Date(booking.startTime);
        const bookingEnd = new Date(booking.endTime);
        const overlapStartMs = Math.max(bookingStart.getTime(), startOfLocalDayUtc.getTime());
        const overlapEndMs = Math.min(bookingEnd.getTime(), endOfLocalDayUtcExclusive.getTime());
        const overlapMs = Math.max(0, overlapEndMs - overlapStartMs);
        return sum + overlapMs / 3_600_000;
      }, 0);
      const requestedHours = (endTime.getTime() - startTime.getTime()) / 3_600_000;

      if (totalBookedHours + requestedHours > 2) {
        this.logger.warn(`User ID: ${options.userId} exceeds daily hourly booking cap on ${startOfLocalDayUtc.toISOString().split('T')[0]}`);
        return { available: false, message: 'User cannot reserve more than 2 total hourly hours in the same day' };
      }
    }

    // Verificação geral para sobreposição de horários
    for (const booking of filteredBookings) {
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

  async findByUser(
    userId: string,
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    sort: string = 'startTime',
    order: 'ASC' | 'DESC' = 'ASC',
  ) {
    this.logger.log(`Fetching bookings for user ID: ${userId} with pagination and sorting`);
    const options: FindManyOptions<Booking> = {
      where: { user: { id: userId }, organizationId },
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
        startTime: this.toUtcIsoString(booking.startTime),
        endTime: this.toUtcIsoString(booking.endTime),
        userId: booking.user.id,
        userApartment: booking.user.apartment,
        userBlock: booking.user.block,
        bookedOnBehalf: booking.bookedOnBehalf,
        needTablesAndChairs: booking.needTablesAndChairs,
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async findAll(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    sort: string = 'startTime',
    order: 'ASC' | 'DESC' = 'ASC',
    startDate?: string,
    endDate?: string,
  ) {
    this.logger.log('Fetching all bookings with pagination and sorting');

    const validSortColumns = ['startTime', 'endTime', 'resourceType', 'userApartment'];
    if (!validSortColumns.includes(sort)) {
      throw new BadRequestException(`Invalid sort column: ${sort}`);
    }

    const queryBuilder = this.bookingRepository.createQueryBuilder('booking')
      .leftJoinAndSelect('booking.resource', 'resource')
      .leftJoinAndSelect('booking.user', 'user')
      .where('booking.organizationId = :organizationId', { organizationId })
      .take(limit)
      .skip((page - 1) * limit);

    if (startDate) {
      const startDateTime = new Date(`${startDate}T00:00:00.000Z`);
      if (Number.isNaN(startDateTime.getTime())) {
        throw new BadRequestException(`Invalid startDate: ${startDate}`);
      }
      queryBuilder.andWhere('booking.startTime >= :startDate', { startDate: startDateTime });
    }

    if (endDate) {
      const endDateTime = new Date(`${endDate}T23:59:59.999Z`);
      if (Number.isNaN(endDateTime.getTime())) {
        throw new BadRequestException(`Invalid endDate: ${endDate}`);
      }
      queryBuilder.andWhere('booking.startTime <= :endDate', { endDate: endDateTime });
    }

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
        startTime: this.toUtcIsoString(booking.startTime),
        endTime: this.toUtcIsoString(booking.endTime),
        userId: booking.user.id,
        userApartment: booking.user.apartment,
        userBlock: booking.user.block,
        bookedOnBehalf: booking.bookedOnBehalf,
        needTablesAndChairs: booking.needTablesAndChairs,
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async remove(bookingId: string, userId: string, organizationId: string) {
    this.logger.log(`Removing booking ID: ${bookingId} by user ID: ${userId}`);
    
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId, organizationId },
      relations: ['user'],
    });
    if (!booking) {
      this.logger.warn(`Booking not found: ${bookingId}`);
      throw new NotFoundException('Booking not found');
    }
  
    const user = await this.userRepository.findOne({ where: { id: userId, organizationId } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }
  
    if (user.role !== UserRole.ADMIN && booking.user.id !== userId) {
      this.logger.warn(`User ID: ${userId} is not authorized to remove booking ID: ${bookingId}`);
      throw new ForbiddenException('You are not authorized to remove this booking');
    }
  
    await this.bookingRepository.remove(booking);
    this.logger.log(`Booking removed successfully: ${bookingId}`);
    return { message: 'Booking removed successfully' };
  }

  async getReservedTimes(organizationId: string, resourceType: string, date?: string) {
    this.logger.log(`Fetching reserved times for resourceType: ${resourceType}${date ? ` on date: ${date}` : ''}`);

    const resources = await this.resourceRepository.find({ where: { type: resourceType, organizationId } });
    if (resources.length === 0) {
      this.logger.warn(`No resources found for type: ${resourceType}`);
      throw new BadRequestException(`No resources found for type: ${resourceType}`);
    }

    if (resourceType === 'daily') {
      const bookings = await this.bookingRepository.find({
        where: { resource: { type: resourceType }, organizationId },
        relations: ['resource', 'user'],
      });

      const reservedDayDetails: Record<string, { userId: string | null; userApartment: string | null; userBlock: number | null; bookedOnBehalf: string | null }> = {};

      bookings.forEach(booking => {
        const [dayStartUtc] = this.getSaoPauloUtcDayRangeForInstant(new Date(booking.startTime));
        const dayKey = dayStartUtc.toISOString().split('T')[0];
        reservedDayDetails[dayKey] = {
          userId: booking.userId ?? null,
          userApartment: booking.user?.apartment ?? null,
          userBlock: booking.user?.block ?? null,
          bookedOnBehalf: booking.bookedOnBehalf ?? null,
        };
      });

      const reservedDays = Object.keys(reservedDayDetails);
      return { reservedDays, reservedDayDetails };
    }

    if (!date) {
      this.logger.warn('Date parameter is required for hourly resources');
      throw new BadRequestException('Date parameter is required for hourly resources');
    }

    const [startOfLocalDayUtc, endOfLocalDayUtcExclusive] = this.getSaoPauloUtcDayRange(date);

    const bookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.resource', 'resource')
      .leftJoinAndSelect('booking.user', 'user')
      .where('resource.type = :resourceType', { resourceType })
      .andWhere('booking.organizationId = :organizationId', { organizationId })
      .andWhere('booking.startTime < :endOfLocalDayUtcExclusive', { endOfLocalDayUtcExclusive })
      .andWhere('booking.endTime > :startOfLocalDayUtc', { startOfLocalDayUtc })
      .getMany();

    const reservedTimes = bookings.map(booking => ({
      startTime: this.toUtcIsoString(booking.startTime),
      endTime: this.toUtcIsoString(booking.endTime),
      userId: booking.userId ?? null,
      userApartment: booking.user?.apartment ?? null,
      userBlock: booking.user?.block ?? null,
      bookedOnBehalf: booking.bookedOnBehalf ?? null,
    }));

    return { reservedTimes };
  }

  private getSaoPauloUtcDayRange(date: string): [Date, Date] {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      this.logger.warn(`Invalid date format for reserved-times: ${date}`);
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }

    const startOfLocalDayUtc = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(startOfLocalDayUtc.getTime())) {
      this.logger.warn(`Invalid date value for reserved-times: ${date}`);
      throw new BadRequestException('Invalid date value');
    }

    startOfLocalDayUtc.setUTCHours(startOfLocalDayUtc.getUTCHours() + BookingService.SAO_PAULO_UTC_OFFSET_HOURS);
    const endOfLocalDayUtcExclusive = new Date(startOfLocalDayUtc);
    endOfLocalDayUtcExclusive.setUTCDate(endOfLocalDayUtcExclusive.getUTCDate() + 1);

    return [startOfLocalDayUtc, endOfLocalDayUtcExclusive];
  }

  private getSaoPauloUtcDayRangeForInstant(dateTime: Date): [Date, Date] {
    const instantMs = dateTime.getTime();
    if (Number.isNaN(instantMs)) {
      this.logger.warn(`Invalid instant provided for Sao Paulo day range: ${dateTime}`);
      throw new BadRequestException('Invalid start or end time');
    }

    const localProxy = new Date(instantMs);
    localProxy.setUTCHours(localProxy.getUTCHours() - BookingService.SAO_PAULO_UTC_OFFSET_HOURS);

    const localDayStartProxyUtc = new Date(Date.UTC(
      localProxy.getUTCFullYear(),
      localProxy.getUTCMonth(),
      localProxy.getUTCDate(),
      0, 0, 0, 0,
    ));
    localDayStartProxyUtc.setUTCHours(localDayStartProxyUtc.getUTCHours() + BookingService.SAO_PAULO_UTC_OFFSET_HOURS);

    const endOfLocalDayUtcExclusive = new Date(localDayStartProxyUtc);
    endOfLocalDayUtcExclusive.setUTCDate(endOfLocalDayUtcExclusive.getUTCDate() + 1);

    return [localDayStartProxyUtc, endOfLocalDayUtcExclusive];
  }

  private toUtcIsoString(value: Date | string): string {
    const dateValue = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
      this.logger.warn(`Invalid booking timestamp found during serialization: ${value}`);
      throw new BadRequestException('Invalid booking timestamp');
    }

    return dateValue.toISOString();
  }

  private serializeBookingTimestampFields<T extends { startTime: Date | string; endTime: Date | string }>(booking: T) {
    return {
      ...booking,
      startTime: this.toUtcIsoString(booking.startTime),
      endTime: this.toUtcIsoString(booking.endTime),
    };
  }

  private validateTimeRange(startTime: Date, endTime: Date, action: string) {
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      this.logger.warn(`Invalid start or end time when ${action} booking`);
      throw new BadRequestException('Invalid start or end time');
    }

    if (endMs <= startMs) {
      this.logger.warn(`End time must be after start time when ${action} booking`);
      throw new BadRequestException('End time must be after start time');
    }
  }

  private validateStartTimePolicy(resourceType: string, startTime: Date, operation: 'create' | 'update') {
    const now = new Date();
    if (resourceType === 'hourly') {
      if (startTime.getTime() <= now.getTime()) {
        this.logger.warn(`Cannot ${operation} hourly booking in the past: ${startTime.toISOString()}`);
        throw new BadRequestException(`Cannot ${operation} hourly booking for a past time`);
      }
      return;
    }

    const [startOfTodaySaoPauloUtc] = this.getSaoPauloUtcDayRangeForInstant(now);
    const startOfTomorrowUtc = new Date(startOfTodaySaoPauloUtc);
    startOfTomorrowUtc.setUTCDate(startOfTomorrowUtc.getUTCDate() + 1);
    if (startTime.getTime() < startOfTomorrowUtc.getTime()) {
      this.logger.warn(`Cannot ${operation} booking for today or a past date: ${startTime.toISOString()}`);
      throw new BadRequestException(`Cannot ${operation} booking for today or a past date`);
    }
  }

  private ensureSameSaoPauloDay(startTime: Date, endTime: Date, bookingLabel: string) {
    const [startDayStartUtc] = this.getSaoPauloUtcDayRangeForInstant(startTime);
    const [endDayStartUtc] = this.getSaoPauloUtcDayRangeForInstant(endTime);
    if (startDayStartUtc.getTime() !== endDayStartUtc.getTime()) {
      this.logger.warn(`${bookingLabel} must start and end on the same Sao Paulo date`);
      throw new BadRequestException(`${bookingLabel} must start and end on the same day`);
    }
  }
}
