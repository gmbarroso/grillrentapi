import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private users: Array<{ id: number; username: string; email: string; apartment: string; password: string }> = [];
  constructor(private readonly jwtService: JwtService) {}

  async register(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = { id: Date.now(), ...createUserDto, password: hashedPassword };
    this.users.push(user);
    this.logger.log(`User registered successfully: ${user.username}`);
    return { message: 'User registered successfully', user };
  }

  async login(loginUserDto: LoginUserDto) {
    this.logger.log(`Logging in user: ${loginUserDto.username}`);
    const user = await this.findOne(loginUserDto.username);
    if (!user || !(await this.comparePasswords(loginUserDto.password, user.password))) {
      this.logger.warn(`Invalid credentials for user: ${loginUserDto.username}`);
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { username: user.username, sub: user.id };
    const token = this.jwtService.sign(payload);
    this.logger.log(`User logged in successfully: ${user.username}`);
    return { message: 'User logged in successfully', token };
  }

  async getProfile(userId: string) {
    this.logger.log(`Fetching profile for user ID: ${userId}`);
    const user = this.users.find(u => u.id === parseInt(userId));
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new UnauthorizedException('User not found');
    }
    this.logger.log(`User profile retrieved successfully: ${user.username}`);
    return { message: 'User profile retrieved successfully', user };
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    this.logger.log(`Updating profile for user ID: ${userId}`);
    const userIndex = this.users.findIndex(u => u.id === parseInt(userId));
    if (userIndex === -1) {
      this.logger.warn(`User not found: ${userId}`);
      throw new UnauthorizedException('User not found');
    }
    const updatedUser = { ...this.users[userIndex], ...updateUserDto };
    this.users[userIndex] = updatedUser;
    this.logger.log(`User profile updated successfully: ${updatedUser.username}`);
    return { message: 'User profile updated successfully', user: updatedUser };
  }

  async findOne(username: string) {
    this.logger.log(`Finding user by username: ${username}`);
    return this.users.find(user => user.username === username);
  }

  async comparePasswords(password: string, storedPasswordHash: string) {
    this.logger.log(`Comparing passwords for user`);
    return bcrypt.compare(password, storedPasswordHash);
  }
}
