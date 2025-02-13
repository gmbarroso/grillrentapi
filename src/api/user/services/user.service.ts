import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.userRepository.create({ ...createUserDto, password: hashedPassword });
    await this.userRepository.save(user);
    this.logger.log(`User registered successfully: ${user.username}`);
    return { message: 'User registered successfully', user };
  }

  async login(loginUserDto: LoginUserDto) {
    this.logger.log(`Logging in user: ${loginUserDto.username}`);
    const user = await this.userRepository.findOne({ where: { username: loginUserDto.username } });
    if (!user || !(await bcrypt.compare(loginUserDto.password, user.password))) {
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
    const user = await this.userRepository.findOne({ where: { id: parseInt(userId, 10) } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new UnauthorizedException('User not found');
    }
    this.logger.log(`User profile retrieved successfully: ${user.username}`);
    return { message: 'User profile retrieved successfully', user };
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    this.logger.log(`Updating profile for user ID: ${userId}`);
    const user = await this.userRepository.findOne({ where: { id: parseInt(userId, 10) } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new UnauthorizedException('User not found');
    }
    Object.assign(user, updateUserDto);
    await this.userRepository.save(user);
    this.logger.log(`User profile updated successfully: ${user.username}`);
    return { message: 'User profile updated successfully', user };
  }
}
