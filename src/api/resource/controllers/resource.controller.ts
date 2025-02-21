import { Controller, Post, Body, Logger, Get, Put, Delete, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { CreateResourceDto, CreateResourceSchema } from '../dto/create-resource.dto';
import { UpdateResourceDto, UpdateResourceSchema } from '../dto/update-resource.dto';
import { ResourceService } from '../services/resource.service';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { User } from '../../../shared/auth/decorators/user.decorator';
import { User as UserEntity, UserRole } from '../../user/entities/user.entity';

@Controller('resources')
@UseGuards(JwtAuthGuard)
export class ResourceController {
  private readonly logger = new Logger(ResourceController.name);

  constructor(private readonly resourceService: ResourceService) {}

  @Post()
  async create(@User() user: UserEntity, @Body(new JoiValidationPipe(CreateResourceSchema)) createResourceDto: CreateResourceDto) {
    this.logger.log(`User ID: ${user.id} with role: ${user.role} attempting to create resource`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to create resources`);
      throw new ForbiddenException('You do not have permission to create resources');
    }
    const result = await this.resourceService.create(createResourceDto);
    this.logger.log(`Resource created successfully by user ID: ${user.id}`);
    return result;
  }

  @Get()
  async findAll(@User() user: UserEntity) {
    this.logger.log(`User ID: ${user.id} with role: ${user.role} attempting to find all resources`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to view resources`);
      throw new ForbiddenException('You do not have permission to view resources');
    }
    return this.resourceService.findAll();
  }

  @Get(':id')
  async findOne(@User() user: UserEntity, @Param('id') id: string) {
    this.logger.log(`User ID: ${user.id} with role: ${user.role} attempting to find resource ID: ${id}`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to view resources`);
      throw new ForbiddenException('You do not have permission to view resources');
    }
    return this.resourceService.findOne(id);
  }

  @Put(':id')
  async update(@User() user: UserEntity, @Param('id') id: string, @Body(new JoiValidationPipe(UpdateResourceSchema)) updateResourceDto: UpdateResourceDto) {
    this.logger.log(`User ID: ${user.id} with role: ${user.role} attempting to update resource ID: ${id}`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to update resources`);
      throw new ForbiddenException('You do not have permission to update resources');
    }
    return this.resourceService.update(id, updateResourceDto);
  }

  @Delete(':id')
  async remove(@User() user: UserEntity, @Param('id') id: string) {
    this.logger.log(`User ID: ${user.id} with role: ${user.role} attempting to remove resource ID: ${id}`);
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${user.id} does not have permission to delete resources`);
      throw new ForbiddenException('You do not have permission to delete resources');
    }
    const result = await this.resourceService.remove(id);
    this.logger.log(`Resource removed successfully by user ID: ${user.id}`);
    return result;
  }
}
