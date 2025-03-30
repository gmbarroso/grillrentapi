import { Injectable, UnauthorizedException, Logger, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginUserDto } from '../dto/login-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User, UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../../shared/auth/services/auth.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async login(loginUserDto: LoginUserDto) {
    this.logger.log(`Logging in user from apartment: ${loginUserDto.apartment}, block: ${loginUserDto.block}`);
    const user = await this.userRepository.findOne({ where: { apartment: loginUserDto.apartment, block: loginUserDto.block } });
    if (!user || !(await bcrypt.compare(loginUserDto.password, user.password))) {
      this.logger.warn(`Invalid credentials for apartment: ${loginUserDto.apartment}, block: ${loginUserDto.block}`);
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { name: user.name, sub: user.id, role: user.role };
    const token = this.jwtService.sign(payload);
    this.logger.log(`User logged in successfully: ${user.name}`);
    return { message: 'User logged in successfully', token };
  }

  async getProfile(userId: string) {
    this.logger.log(`Fetching profile for user ID: ${userId}`);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new UnauthorizedException('User not found');
    }
    this.logger.log(`User profile retrieved successfully: ${user.name}`);
    return { message: 'User profile retrieved successfully', user };
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto, currentUser: User) {
    this.logger.log(`Updating profile for user ID: ${userId}`);
    const user = await this.userRepository.findOne({ where: { id: userId } });
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

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = updatedUser;

    this.logger.log(`User profile updated successfully: ${user.name}`);
    return { message: 'User profile updated successfully', user: updatedUser };
  }

  async getAllUsers() {
    this.logger.log('Fetching all users');
    const users = await this.userRepository.find();
    return { message: 'All users retrieved successfully', users };
  }

  async remove(userId: string) {
    this.logger.log(`Removing user ID: ${userId}`);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }
    await this.userRepository.remove(user);
    this.logger.log(`User removed successfully: ${userId}`);
    return { message: 'User removed successfully' };
  }
}
