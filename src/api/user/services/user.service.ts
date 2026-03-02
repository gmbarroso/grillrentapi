import { Injectable, UnauthorizedException, Logger, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User, UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly defaultOrganizationId: string;
  private static readonly LEGACY_DEFAULT_ORGANIZATION_ID = '9dd02335-74fa-487b-99f3-f3e6f9fba2af';
  private static readonly LOCAL_LIKE_ENVS = new Set(['local', 'development', 'dev', 'test']);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    this.defaultOrganizationId = this.resolveDefaultOrganizationId();
  }

  async register(createUserDto: CreateUserDto) {
    const { name, email, apartment, block, password, role } = createUserDto;
    const organizationId = this.defaultOrganizationId;

    const existingUser = await this.userRepository.findOne({
      where: [{ email, organizationId }, { apartment, block, organizationId }],
    });

    if (existingUser) {
      throw new ConflictException('Email, apartment or block already in use for this organization');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({ name, email, apartment, block, role, password: hashedPassword, organizationId });
    return this.userRepository.save(user);
  }

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

  private resolveDefaultOrganizationId(): string {
    const configuredDefaultOrganizationId = this.configService.get<string>('DEFAULT_ORGANIZATION_ID');
    const nodeEnv = (this.configService.get<string>('NODE_ENV') || '').trim().toLowerCase();
    const isLocalLikeEnv = UserService.LOCAL_LIKE_ENVS.has(nodeEnv);

    if (!configuredDefaultOrganizationId) {
      if (isLocalLikeEnv) {
        return UserService.LEGACY_DEFAULT_ORGANIZATION_ID;
      }
      throw new Error('DEFAULT_ORGANIZATION_ID must be configured in non-local environments');
    }

    const normalizedOrganizationId = configuredDefaultOrganizationId.trim().toLowerCase();
    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedOrganizationId,
    );
    if (!isValidUuid) {
      throw new Error('DEFAULT_ORGANIZATION_ID must be a valid UUID');
    }

    return normalizedOrganizationId;
  }
}
