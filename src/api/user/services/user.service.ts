import { Injectable, UnauthorizedException, Logger, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User, UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getProfile(userId: string, organizationId: string) {
    this.logger.log(`Fetching profile for user ID: ${userId}`);
    const user = await this.userRepository.findOne({ where: { id: userId, organizationId } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new UnauthorizedException('User not found');
    }
    this.logger.log(`User profile retrieved successfully: ${user.name}`);
    return { message: 'User profile retrieved successfully', user };
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto, currentUser: User) {
    this.logger.log(`Updating profile for user ID: ${userId}`);
    const user = await this.userRepository.findOne({
      where: { id: userId, organizationId: currentUser.organizationId },
    });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new UnauthorizedException('User not found');
    }

    if (currentUser.role !== UserRole.ADMIN) {
      if (updateUserDto.apartment || updateUserDto.block) {
        this.logger.warn(`User ID: ${currentUser.id} does not have permission to update apartment or block`);
        throw new ForbiddenException('You do not have permission to update apartment or block');
      }
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    if (updateUserDto.email !== undefined) {
      updateUserDto.email = updateUserDto.email?.trim().toLowerCase() || null;
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = updatedUser;

    this.logger.log(`User profile updated successfully: ${user.name}`);
    return { message: 'User profile updated successfully', user: updatedUser };
  }

  async getAllUsers(organizationId: string) {
    this.logger.log('Fetching all users');
    const users = await this.userRepository.find({ where: { organizationId } });
    return { message: 'All users retrieved successfully', users };
  }

  async remove(userId: string, organizationId: string) {
    this.logger.log(`Removing user ID: ${userId}`);
    const user = await this.userRepository.findOne({ where: { id: userId, organizationId } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }
    await this.userRepository.remove(user);
    this.logger.log(`User removed successfully: ${userId}`);
    return { message: 'User removed successfully' };
  }

  async updateUserById(userId: string, updateUserDto: UpdateUserDto, currentUser: User) {
    this.logger.log(`Updating user ID: ${userId} by admin ID: ${currentUser.id}`);
    const user = await this.userRepository.findOne({
      where: { id: userId, organizationId: currentUser.organizationId },
    });

    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    if (updateUserDto.email !== undefined) {
      updateUserDto.email = updateUserDto.email?.trim().toLowerCase() || null;
    }

    Object.assign(user, updateUserDto);

    try {
      const updatedUser = await this.userRepository.save(user);
      this.logger.log(`User updated successfully: ${userId}`);
      return { message: 'User updated successfully', user: updatedUser };
    } catch (error) {
      this.logger.error(`Error updating user ${userId}: ${error.message}`);
      if (error?.code === '23505') {
        throw new ConflictException('User already exists');
      }
      throw error;
    }
  }
}
