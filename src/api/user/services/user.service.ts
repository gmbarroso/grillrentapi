import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User, UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import {
  ChangeOnboardingPasswordDto,
  SetOnboardingEmailDto,
  UserOnboardingStatusDto,
  VerifyOnboardingEmailDto,
} from '../dto/onboarding.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private static readonly EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 30;

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
    return {
      message: 'User profile retrieved successfully',
      user: this.toSafeUser(user),
      onboarding: this.deriveOnboardingStatus(user),
    };
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
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    if (updateUserDto.email !== undefined) {
      const normalizedEmail = updateUserDto.email?.trim().toLowerCase() || null;
      user.pendingEmail = normalizedEmail;
      if (normalizedEmail) {
        this.issueVerificationToken(user);
      } else {
        user.email = null;
        user.emailVerifiedAt = null;
        user.pendingEmail = null;
        user.emailVerificationTokenHash = null;
        user.emailVerificationExpiresAt = null;
      }
    }

    Object.assign(user, {
      name: updateUserDto.name ?? user.name,
      apartment: updateUserDto.apartment ?? user.apartment,
      block: updateUserDto.block ?? user.block,
    });
    const updatedUser = await this.userRepository.save(user);

    this.logger.log(`User profile updated successfully: ${user.name}`);
    return {
      message: 'User profile updated successfully',
      user: this.toSafeUser(updatedUser),
      onboarding: this.deriveOnboardingStatus(updatedUser),
    };
  }

  async getAllUsers(organizationId: string) {
    this.logger.log('Fetching all users');
    const users = await this.userRepository.find({ where: { organizationId } });
    return { message: 'All users retrieved successfully', users: users.map((user) => this.toSafeUser(user)) };
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
      user.password = await bcrypt.hash(updateUserDto.password, 10);
      user.mustChangePassword = true;
    }
    if (updateUserDto.email !== undefined) {
      const normalizedEmail = updateUserDto.email?.trim().toLowerCase() || null;
      user.pendingEmail = normalizedEmail;
      if (normalizedEmail) {
        this.issueVerificationToken(user);
      } else {
        user.email = null;
        user.emailVerifiedAt = null;
        user.pendingEmail = null;
        user.emailVerificationTokenHash = null;
        user.emailVerificationExpiresAt = null;
      }
    }

    Object.assign(user, {
      name: updateUserDto.name ?? user.name,
      apartment: updateUserDto.apartment ?? user.apartment,
      block: updateUserDto.block ?? user.block,
    });

    try {
      const updatedUser = await this.userRepository.save(user);
      this.logger.log(`User updated successfully: ${userId}`);
      return {
        message: 'User updated successfully',
        user: this.toSafeUser(updatedUser),
        onboarding: this.deriveOnboardingStatus(updatedUser),
      };
    } catch (error) {
      this.logger.error(`Error updating user ${userId}: ${error.message}`);
      if (error?.code === '23505') {
        throw new ConflictException('User already exists');
      }
      throw error;
    }
  }

  async setOnboardingEmail(
    userId: string,
    organizationId: string,
    payload: SetOnboardingEmailDto,
  ): Promise<{ message: string; onboarding: UserOnboardingStatusDto; verificationTokenPreview?: string }> {
    const user = await this.findUserForOnboarding(userId, organizationId);
    const normalizedEmail = payload.email.trim().toLowerCase();

    const duplicate = await this.userRepository.findOne({
      where: {
        organizationId,
        email: normalizedEmail,
      },
    });
    if (duplicate && duplicate.id !== user.id) {
      throw new ConflictException('Email is already in use');
    }

    user.pendingEmail = normalizedEmail;
    const plainToken = this.issueVerificationToken(user);
    await this.userRepository.save(user);

    return {
      message: 'Verification token generated',
      onboarding: this.deriveOnboardingStatus(user),
      ...this.buildTokenPreviewResponse(plainToken),
    };
  }

  async verifyOnboardingEmail(
    userId: string,
    organizationId: string,
    payload: VerifyOnboardingEmailDto,
  ): Promise<{ message: string; user: Record<string, unknown>; onboarding: UserOnboardingStatusDto }> {
    const user = await this.findUserForOnboarding(userId, organizationId);

    if (!user.pendingEmail || !user.emailVerificationTokenHash || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('No email verification is pending');
    }

    if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification token expired');
    }

    const incomingHash = this.hashVerificationToken(payload.token.trim());
    if (incomingHash !== user.emailVerificationTokenHash) {
      throw new BadRequestException('Invalid verification token');
    }

    const duplicate = await this.userRepository.findOne({
      where: {
        organizationId,
        email: user.pendingEmail,
      },
    });
    if (duplicate && duplicate.id !== user.id) {
      throw new ConflictException('Email is already in use');
    }

    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;

    const updated = await this.userRepository.save(user);
    return {
      message: 'Email verified successfully',
      user: this.toSafeUser(updated),
      onboarding: this.deriveOnboardingStatus(updated),
    };
  }

  async changeOnboardingPassword(
    userId: string,
    organizationId: string,
    payload: ChangeOnboardingPasswordDto,
  ): Promise<{ message: string; user: Record<string, unknown>; onboarding: UserOnboardingStatusDto }> {
    const user = await this.findUserForOnboarding(userId, organizationId);
    const isCurrentPasswordValid = await bcrypt.compare(payload.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is invalid');
    }
    if (payload.currentPassword === payload.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    user.password = await bcrypt.hash(payload.newPassword, 10);
    user.mustChangePassword = false;

    const updated = await this.userRepository.save(user);
    return {
      message: 'Password updated successfully',
      user: this.toSafeUser(updated),
      onboarding: this.deriveOnboardingStatus(updated),
    };
  }

  private async findUserForOnboarding(userId: string, organizationId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, organizationId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.role !== UserRole.RESIDENT) {
      throw new ForbiddenException('Onboarding endpoints are available only to residents');
    }
    return user;
  }

  private issueVerificationToken(user: User): string {
    const plainToken = randomBytes(32).toString('hex');
    user.emailVerificationTokenHash = this.hashVerificationToken(plainToken);
    user.emailVerificationExpiresAt = new Date(Date.now() + UserService.EMAIL_VERIFICATION_TTL_MS);
    return plainToken;
  }

  private hashVerificationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildTokenPreviewResponse(token: string): { verificationTokenPreview?: string } {
    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
    if (nodeEnv === 'production') {
      return {};
    }
    return { verificationTokenPreview: token };
  }

  private deriveOnboardingStatus(user: User): UserOnboardingStatusDto {
    const hasVerifiedActiveEmail = Boolean(user.email && user.emailVerifiedAt);
    const mustProvideEmail = !user.email && !user.pendingEmail;
    const mustVerifyEmail = !hasVerifiedActiveEmail && !mustProvideEmail;
    const mustChangePassword = Boolean(user.mustChangePassword);
    const onboardingRequired = !hasVerifiedActiveEmail || mustChangePassword;
    return {
      mustProvideEmail,
      mustVerifyEmail,
      mustChangePassword,
      onboardingRequired,
      isOnboardingComplete: !onboardingRequired,
    };
  }

  private toSafeUser(user: User): Record<string, unknown> {
    const {
      password: _password,
      emailVerificationTokenHash: _emailVerificationTokenHash,
      ...safeUser
    } = user;

    return safeUser;
  }
}
