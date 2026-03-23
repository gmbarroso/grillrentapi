import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User, UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import {
  ChangePasswordDto,
  ChangeOnboardingPasswordDto,
  SetOnboardingEmailDto,
  UserOnboardingStatusDto,
  VerifyOnboardingEmailDto,
} from '../dto/onboarding.dto';
import { CompleteFirstAccessTourDto, UserTourStateDto } from '../dto/tour.dto';
import { ForgotPasswordConfirmDto, ForgotPasswordRequestDto } from '../dto/forgot-password.dto';
import { EmailService } from '../../../shared/email/email.service';
import { Organization } from '../../organization/entities/organization.entity';
import { OrganizationContactEmailSettings } from '../../message/entities/organization-contact-email-settings.entity';
import { decryptOrganizationSmtpSecret } from '../../../shared/security/org-smtp-crypto.util';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private static readonly EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 30;
  private static readonly PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationContactEmailSettings)
    private readonly organizationContactEmailSettingsRepository: Repository<OrganizationContactEmailSettings>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
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
      tour: this.deriveTourState(user),
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
      throw new BadRequestException('Use onboarding email endpoint to change email');
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
      tour: this.deriveTourState(updatedUser),
    };
  }

  async completeFirstAccessTour(
    userId: string,
    organizationId: string,
    payload: CompleteFirstAccessTourDto,
  ): Promise<{ message: string; tour: UserTourStateDto }> {
    const requestedVersion = Math.trunc(payload.version);

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        firstAccessTourVersionCompleted: () =>
          'GREATEST(COALESCE(firstAccessTourVersionCompleted, 0), :requestedVersion)',
      })
      .where('id = :userId', { userId })
      .andWhere('organizationId = :organizationId', { organizationId })
      .setParameters({ requestedVersion })
      .execute();

    const updated = await this.userRepository.findOne({
      where: { id: userId, organizationId },
    });
    if (!updated) {
      throw new UnauthorizedException('User not found');
    }

    return {
      message: 'First access tour marked as completed',
      tour: this.deriveTourState(updated),
    };
  }

  async resetFirstAccessTour(
    userId: string,
    organizationId: string,
  ): Promise<{ message: string; tour: UserTourStateDto }> {
    const user = await this.userRepository.findOne({
      where: { id: userId, organizationId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    user.firstAccessTourVersionCompleted = null;
    const updated = await this.userRepository.save(user);

    return {
      message: 'First access tour reset successfully',
      tour: this.deriveTourState(updated),
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
      throw new BadRequestException('Email cannot be changed via admin update endpoint');
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

    const smtpConfig = await this.resolveOrganizationSmtpConfig(organizationId);
    if (smtpConfig) {
      await this.emailService.send({
        to: [normalizedEmail],
        from: smtpConfig.fromHeader,
        subject: 'Verify your email',
        text: [
          `Hello ${user.name},`,
          '',
          `Use this token to verify your email: ${plainToken}`,
          'This token expires in 30 minutes.',
          '',
          'If you did not request this change, ignore this message.',
        ].join('\n'),
        smtp: smtpConfig.smtp,
      });
    } else {
      this.logger.warn(
        `Onboarding verification email skipped because organization SMTP is not configured (organizationId=${organizationId})`,
      );
    }

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

  async changePassword(
    userId: string,
    organizationId: string,
    payload: ChangePasswordDto,
  ): Promise<{ message: string; user: Record<string, unknown>; onboarding: UserOnboardingStatusDto }> {
    const user = await this.userRepository.findOne({
      where: { id: userId, organizationId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

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

  async requestForgotPassword(
    payload: ForgotPasswordRequestDto,
  ): Promise<{ message: string; resetTokenPreview?: string }> {
    const organizationSlug = payload.organizationSlug.trim().toLowerCase();
    const email = payload.email.trim().toLowerCase();
    const genericResponse = { message: 'If this account exists, reset instructions were sent.' };

    if (!organizationSlug || !email) {
      return genericResponse;
    }

    const organization = await this.organizationRepository.findOne({
      where: { slug: organizationSlug },
    });
    if (!organization) {
      return genericResponse;
    }

    const user = await this.userRepository.findOne({
      where: { organizationId: organization.id, email },
    });
    if (!user || !user.email) {
      return genericResponse;
    }

    const plainToken = randomBytes(32).toString('hex');
    user.passwordResetTokenHash = this.hashVerificationToken(plainToken);
    user.passwordResetExpiresAt = new Date(Date.now() + UserService.PASSWORD_RESET_TTL_MS);
    await this.userRepository.save(user);

    const smtpConfig = await this.resolveOrganizationSmtpConfig(organization.id);
    if (smtpConfig) {
      await this.emailService.send({
        to: [user.email],
        from: smtpConfig.fromHeader,
        subject: 'Password reset',
        text: [
          `Hello ${user.name},`,
          '',
          `Use this token to reset your password: ${plainToken}`,
          'This token expires in 30 minutes.',
          '',
          'If you did not request this change, ignore this message.',
        ].join('\n'),
        smtp: smtpConfig.smtp,
      });
    } else {
      this.logger.warn(
        `Forgot-password email skipped because organization SMTP is not configured (organizationId=${organization.id})`,
      );
    }

    if (this.isProductionLike()) {
      return genericResponse;
    }
    return {
      ...genericResponse,
      resetTokenPreview: plainToken,
    };
  }

  async confirmForgotPassword(payload: ForgotPasswordConfirmDto): Promise<{ message: string }> {
    const organizationSlug = payload.organizationSlug.trim().toLowerCase();
    const token = payload.token.trim();
    if (!organizationSlug || !token) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const organization = await this.organizationRepository.findOne({
      where: { slug: organizationSlug },
    });
    if (!organization) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const tokenHash = this.hashVerificationToken(token);
    const user = await this.userRepository.findOne({
      where: {
        organizationId: organization.id,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: MoreThan(new Date()),
      },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password = await bcrypt.hash(payload.newPassword, 10);
    user.mustChangePassword = false;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.userRepository.save(user);
    return { message: 'Password reset successfully' };
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
    if (this.isProductionLike()) {
      return {};
    }
    return { verificationTokenPreview: token };
  }

  private deriveOnboardingStatus(user: User): UserOnboardingStatusDto {
    const hasVerifiedActiveEmail = Boolean(user.email && user.emailVerifiedAt);
    const mustProvideEmail = !user.email && !user.pendingEmail;
    const hasPendingEmailVerification = Boolean(user.pendingEmail);
    const mustVerifyEmail = hasPendingEmailVerification || (!hasVerifiedActiveEmail && !mustProvideEmail);
    const mustChangePassword = Boolean(user.mustChangePassword);
    const onboardingRequired = hasPendingEmailVerification || !hasVerifiedActiveEmail || mustChangePassword;
    return {
      mustProvideEmail,
      mustVerifyEmail,
      mustChangePassword,
      onboardingRequired,
      isOnboardingComplete: !onboardingRequired,
    };
  }

  private deriveTourState(user: User): UserTourStateDto {
    return {
      firstAccessTourVersionCompleted: user.firstAccessTourVersionCompleted ?? null,
    };
  }

  private toSafeUser(user: User): Record<string, unknown> {
    const {
      password: _password,
      emailVerificationTokenHash: _emailVerificationTokenHash,
      passwordResetTokenHash: _passwordResetTokenHash,
      ...safeUser
    } = user;

    return safeUser;
  }

  private async resolveOrganizationSmtpConfig(organizationId: string): Promise<{
    fromHeader: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
      from: string;
    };
  } | null> {
    const settings = await this.organizationContactEmailSettingsRepository.findOne({
      where: { organizationId },
    });
    if (!settings) {
      return null;
    }

    const decryptedPassword = this.decryptSmtpPassword(
      settings.smtpAppPasswordEncrypted || null,
      settings.smtpAppPasswordIv || null,
      settings.smtpAppPasswordAuthTag || null,
      settings.smtpAppPasswordKeyVersion || null,
    );

    if (
      !settings.smtpHost
      || !settings.smtpPort
      || settings.smtpSecure === null
      || settings.smtpSecure === undefined
      || !settings.smtpUser
      || !settings.smtpFrom
      || !decryptedPassword
    ) {
      return null;
    }

    const fromHeader = settings.fromName?.trim()
      ? `${settings.fromName.trim()} <${settings.smtpFrom}>`
      : settings.smtpFrom;

    return {
      fromHeader,
      smtp: {
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: Boolean(settings.smtpSecure),
        user: settings.smtpUser,
        password: decryptedPassword,
        from: settings.smtpFrom,
      },
    };
  }

  private decryptSmtpPassword(
    encrypted: string | null,
    iv: string | null,
    authTag: string | null,
    keyVersion: string | null,
  ): string | null {
    return decryptOrganizationSmtpSecret(
      encrypted,
      iv,
      authTag,
      this.configService,
      keyVersion,
    );
  }

  private isProductionLike(): boolean {
    const env = (this.configService.get<string>('NODE_ENV') || '').toLowerCase();
    return env === 'production' || env === 'staging';
  }
}
