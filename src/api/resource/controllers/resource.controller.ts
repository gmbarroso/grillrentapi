import { Controller, Post, Body, Logger, Get, Put, Delete, Param, UseGuards, ForbiddenException, Req, UnauthorizedException } from '@nestjs/common';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { UpdateResourceDto } from '../dto/update-resource.dto';
import { ResourceService } from '../services/resource.service';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { User } from '../../../shared/auth/decorators/user.decorator';
import { User as UserEntity, UserRole } from '../../user/entities/user.entity';
import { AuthService } from '../../../shared/auth/services/auth.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: UserEntity;
}

@Controller('resources')
export class ResourceController {
  private readonly logger = new Logger(ResourceController.name);

  constructor(
    private readonly resourceService: ResourceService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@User() user: UserEntity, @Body() createResourceDto: CreateResourceDto, @Req() req: AuthenticatedRequest) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }
    const token = authHeader.split(' ')[1];
    const isRevoked = await this.authService.isTokenRevoked(token);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }
    this.logger.log(`Creating resource by user ID: ${user.id}`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to create resources`);
      throw new ForbiddenException('You do not have permission to create resources');
    }
    return this.resourceService.create(createResourceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@User() user: UserEntity, @Req() req: AuthenticatedRequest) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }
    const token = authHeader.split(' ')[1];
    const isRevoked = await this.authService.isTokenRevoked(token);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }
    this.logger.log(`Fetching all resources by user ID: ${user.id}`);
    return this.resourceService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@User() user: UserEntity, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }
    const token = authHeader.split(' ')[1];
    const isRevoked = await this.authService.isTokenRevoked(token);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }
    this.logger.log(`Fetching resource ID: ${id} by user ID: ${user.id}`);
    return this.resourceService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@User() user: UserEntity, @Param('id') id: string, @Body() updateResourceDto: UpdateResourceDto, @Req() req: AuthenticatedRequest) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }
    const token = authHeader.split(' ')[1];
    const isRevoked = await this.authService.isTokenRevoked(token);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }
    this.logger.log(`Updating resource ID: ${id} by user ID: ${user.id}`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to update resources`);
      throw new ForbiddenException('You do not have permission to update resources');
    }
    return this.resourceService.update(id, updateResourceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@User() user: UserEntity, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }
    const token = authHeader.split(' ')[1];
    const isRevoked = await this.authService.isTokenRevoked(token);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }
    this.logger.log(`Removing resource ID: ${id} by user ID: ${user.id}`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to remove resources`);
      throw new ForbiddenException('You do not have permission to remove resources');
    }
    return this.resourceService.remove(id);
  }
}
