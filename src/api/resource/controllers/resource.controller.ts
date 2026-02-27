import { Controller, Post, Body, Logger, Get, Put, Delete, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { UpdateResourceDto } from '../dto/update-resource.dto';
import { ResourceService } from '../services/resource.service';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { User } from '../../../shared/auth/decorators/user.decorator';
import { User as UserEntity, UserRole } from '../../user/entities/user.entity';

@Controller('resources')
export class ResourceController {
  private readonly logger = new Logger(ResourceController.name);

  constructor(private readonly resourceService: ResourceService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@User() user: UserEntity, @Body() createResourceDto: CreateResourceDto) {
    this.logger.log(`Creating resource by user ID: ${user.id}`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to create resources`);
      throw new ForbiddenException('You do not have permission to create resources');
    }
    return this.resourceService.create(createResourceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@User() user: UserEntity) {
    this.logger.log(`Fetching all resources by user ID: ${user.id}`);
    return this.resourceService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@User() user: UserEntity, @Param('id') id: string) {
    this.logger.log(`Fetching resource ID: ${id} by user ID: ${user.id}`);
    return this.resourceService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@User() user: UserEntity, @Param('id') id: string, @Body() updateResourceDto: UpdateResourceDto) {
    this.logger.log(`Updating resource ID: ${id} by user ID: ${user.id}`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to update resources`);
      throw new ForbiddenException('You do not have permission to update resources');
    }
    return this.resourceService.update(id, updateResourceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@User() user: UserEntity, @Param('id') id: string) {
    this.logger.log(`Removing resource ID: ${id} by user ID: ${user.id}`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to remove resources`);
      throw new ForbiddenException('You do not have permission to remove resources');
    }
    return this.resourceService.remove(id);
  }
}
