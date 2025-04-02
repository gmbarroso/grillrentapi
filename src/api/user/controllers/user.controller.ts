import { Controller, Post, Body, Logger, Get, Put, Delete, Param, Req, UseGuards, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto, CreateUserSchema } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserService } from '../services/user.service';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { User } from '../../../shared/auth/decorators/user.decorator';
import { User as UserEntity, UserRole } from '../entities/user.entity';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@User() user: UserEntity) {
    this.logger.log(`Fetching profile for user ID: ${user.id}`);
    return this.userService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@Req() req: any, @Body() updateData: Partial<UserEntity>) {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User ID is missing');
    }

    const updatedUser = await this.userService.updateProfile(userId, updateData, req.user);

    return {
      message: 'User profile updated successfully',
      user: updatedUser,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllUsers() {
    this.logger.log('Fetching all users');
    return this.userService.getAllUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@User() currentUser: UserEntity, @Param('id') id: string) {
    this.logger.log(`Attempting to remove user ID: ${id} by user ID: ${currentUser.id} with role: ${currentUser.role}`);
    if (currentUser.role !== UserRole.ADMIN) {
      this.logger.warn(`User ID: ${currentUser.id} does not have permission to delete users`);
      throw new ForbiddenException('You do not have permission to delete users');
    }
    this.logger.log(`Removing user ID: ${id}`);
    return this.userService.remove(id);
  }
}
