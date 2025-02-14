import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { ResourceService } from '../../resource/services/resource.service';
import { AvailabilityService } from '../../availability/services/availability.service';
import { Booking } from '../entities/booking.entity';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly resourceService: ResourceService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async create(createBookingDto: CreateBookingDto, userId: string) {
    this.logger.log(`Creating booking for user ID: ${userId}`);

    // Verificar se o recurso existe
    const resource = await this.resourceService.findOne(parseInt(createBookingDto.resourceId, 10));
    if (!resource) {
      this.logger.warn(`Resource not found: ${createBookingDto.resourceId}`);
      throw new BadRequestException('Resource not found');
    }

    // Verificar disponibilidade
    const isAvailable = await this.availabilityService.checkAvailability(
      createBookingDto.resourceId,
      new Date(createBookingDto.startTime),
      new Date(createBookingDto.endTime),
    );

    if (!isAvailable.available) {
      this.logger.warn(`Resource ID: ${createBookingDto.resourceId} is not available from ${createBookingDto.startTime} to ${createBookingDto.endTime}`);
      throw new BadRequestException(isAvailable.message);
    }

    const booking = this.bookingRepository.create({ ...createBookingDto, userId });
    await this.bookingRepository.save(booking);
    this.logger.log(`Booking created successfully: ${booking.id}`);
    return { message: 'Booking created successfully', booking };
  }

  async findByUser(userId: string) {
    this.logger.log(`Fetching bookings for user ID: ${userId}`);
    return this.bookingRepository.find({ where: { userId } });
  }

  async remove(bookingId: string) {
    this.logger.log(`Removing booking ID: ${bookingId}`);
    const booking = await this.bookingRepository.findOne({ where: { id: parseInt(bookingId, 10) } });
    if (!booking) {
      this.logger.warn(`Booking not found: ${bookingId}`);
      throw new NotFoundException('Booking not found');
    }
    await this.bookingRepository.remove(booking);
    this.logger.log(`Booking removed successfully: ${bookingId}`);
    return { message: 'Booking removed successfully' };
  }
}
