import { Controller, Post, Body, Logger, Get, Param, Delete, UseGuards, Req, Query, Put, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { CreateBatchBookingDto, CreateBatchBookingSchema } from '../dto/create-batch-booking.dto';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { User, UserRole } from '../../user/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Controller('bookings')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(private readonly bookingService: BookingService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createBookingDto: CreateBookingDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id.toString();
    const userRole = req.user.role;
    const organizationId = this.requireOrganizationId(req);
    this.logger.log(`Creating booking for user ID: ${userId}`);
    return this.bookingService.create(createBookingDto, userId, userRole, organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('batch')
  async createBatch(
    @Body(new JoiValidationPipe(CreateBatchBookingSchema)) createBatchBookingDto: CreateBatchBookingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id.toString();
    const userRole = req.user.role;
    const organizationId = this.requireOrganizationId(req);
    this.logger.log(`Creating batch booking for user ID: ${userId}`);
    return this.bookingService.createBatch(createBatchBookingDto, userId, userRole, organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateBookingDto: Partial<CreateBookingDto>,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id.toString();
    const userRole = req.user.role;
    const organizationId = this.requireOrganizationId(req);
    this.logger.log(`Updating booking ID: ${id} by user ID: ${userId}`);
    return this.bookingService.update(id, updateBookingDto, userId, userRole, organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async findByUser(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('sort') sort: string = 'startTime',
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
  ) {
    const requesterId = req.user.id.toString();
    const isAdmin = req.user.role === UserRole.ADMIN;
    if (!isAdmin && requesterId !== userId) {
      throw new ForbiddenException('You do not have permission to view bookings for this user');
    }
    this.logger.log(`Fetching bookings for user ID: ${userId}`);
    return this.bookingService.findByUser(userId, this.requireOrganizationId(req), page, limit, sort, order);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('sort') sort: string = 'startTime',
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('q') q?: string,
  ) {
    this.logger.log('Fetching all bookings');
    return this.bookingService.findAll(this.requireOrganizationId(req), page, limit, sort, order, startDate, endDate, q);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id.toString();
    this.logger.log(`Removing booking ID: ${id} by user ID: ${userId}`);
    return this.bookingService.remove(id, userId, this.requireOrganizationId(req));
  }

  @UseGuards(JwtAuthGuard)
  @Get('availability/:resourceId')
  async checkAvailability(
    @Param('resourceId') resourceId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id.toString();
    this.logger.log(`Checking availability for resource ID: ${resourceId} from ${startTime} to ${endTime}`);
    return this.bookingService.checkAvailability(resourceId, new Date(startTime), new Date(endTime), {
      userId,
      organizationId: this.requireOrganizationId(req),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('reserved-times')
  async getReservedTimes(
    @Req() req: AuthenticatedRequest,
    @Query('resourceType') resourceType: string,
    @Query('date') date?: string,
  ) {
    this.logger.log(`Fetching reserved times for resourceType: ${resourceType}${date ? ` on date: ${date}` : ''}`);
    return this.bookingService.getReservedTimes(this.requireOrganizationId(req), resourceType, date);
  }

  private requireOrganizationId(req: AuthenticatedRequest): string {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      throw new UnauthorizedException('Organization context is missing');
    }
    return organizationId;
  }
}
