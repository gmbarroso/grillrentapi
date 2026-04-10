import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
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
import { EmailService, type SendEmailResult } from '../../../shared/email/email.service';
import { Organization } from '../../organization/entities/organization.entity';
import { OrganizationContactEmailSettings } from '../../message/entities/organization-contact-email-settings.entity';
import { composeFromHeader, isValidEmailAddress, normalizeEmailAddress } from '../../../shared/email/email-address.util';
import { Booking } from '../../booking/entities/booking.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private static readonly EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 30;
  private static readonly PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;
  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_LIMIT = 10;
  private static readonly MAX_LIMIT = 100;
  private static readonly ALLOWED_USER_SORTS = new Map<string, string>([
    ['name', 'user.name'],
    ['email', 'user.email'],
    ['apartment', 'user.apartment'],
    ['block', 'user.block'],
    ['role', 'user.role'],
    ['emailVerifiedAt', 'user.emailVerifiedAt'],
  ]);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
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
          'GREATEST(COALESCE("firstAccessTourVersionCompleted", 0), :requestedVersion)',
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

  async getAllUsers(
    organizationId: string,
    options?: {
      q?: string;
      page?: string;
      limit?: string;
      sort?: string;
      order?: string;
      role?: string;
    },
  ) {
    this.logger.log('Fetching users with server-side pagination and query filtering');

    const page = this.normalizePage(options?.page);
    const limit = this.normalizeLimit(options?.limit);
    const sort = this.normalizeSort(options?.sort);
    const order = this.normalizeOrder(options?.order);
    const q = options?.q?.trim();
    const role = this.normalizeRole(options?.role);

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.organizationId = :organizationId', { organizationId })
      .take(limit)
      .skip((page - 1) * limit);

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (q) {
      const normalizedQuery = `%${q.toLowerCase()}%`;
      queryBuilder.andWhere(
        `(
          LOWER(user.name) LIKE :q
          OR LOWER(COALESCE(user.email, '')) LIKE :q
          OR LOWER(user.apartment) LIKE :q
          OR CAST(user.block AS TEXT) LIKE :q
          OR LOWER(CONCAT(user.apartment, ' bl. ', user.block)) LIKE :q
        )`,
        { q: normalizedQuery },
      );
    }

    // Prioritize users with verified email first, then apply requested deterministic sorting.
    queryBuilder
      .addOrderBy(
        `CASE WHEN user.email IS NOT NULL AND user.emailVerifiedAt IS NOT NULL THEN 0 ELSE 1 END`,
        'ASC',
      )
      .addOrderBy(sort, order)
      .addOrderBy('user.id', 'ASC');

    const [users, total] = await queryBuilder.getManyAndCount();
    const lastPage = Math.max(1, Math.ceil(total / limit));

    return {
      data: users.map((user) => this.toSafeUser(user)),
      total,
      page,
      lastPage,
    };
  }

  async remove(userId: string, organizationId: string) {
    this.logger.log(`Removing user ID: ${userId}`);
    const user = await this.userRepository.findOne({ where: { id: userId, organizationId } });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }

    await this.userRepository.manager.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.delete(Booking, { userId, organizationId });
      await transactionalEntityManager.remove(user);
    });
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

    const emailResult = await this.sendOnboardingVerificationEmail(organizationId, user.name, normalizedEmail, plainToken);
    if (emailResult.status !== 'sent') {
      const reason = emailResult.errorMessage || 'Unknown email delivery error';
      this.logger.error(
        `Onboarding verification email was not delivered (status=${emailResult.status}, organizationId=${organizationId}): ${reason}`,
      );
      if (this.isProductionLike()) {
        throw new ServiceUnavailableException('Não foi possível enviar o token de verificação por e-mail. Tente novamente.');
      }
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

    const organizationFrom = await this.resolveOrganizationSenderFrom(organization.id);
    await this.emailService.send({
      to: [user.email],
      from: organizationFrom || undefined,
      subject: 'Password reset',
      text: [
        `Hello ${user.name},`,
        '',
        `Use this token to reset your password: ${plainToken}`,
        'This token expires in 30 minutes.',
        '',
        'If you did not request this change, ignore this message.',
      ].join('\n'),
    });

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

  private async resolveOrganizationSenderFrom(organizationId: string): Promise<string | null> {
    const settings = await this.organizationContactEmailSettingsRepository.findOne({
      where: { organizationId },
    });
    if (!settings?.fromEmail) {
      return null;
    }

    const fromEmail = normalizeEmailAddress(settings.fromEmail);
    if (!fromEmail || !isValidEmailAddress(fromEmail)) {
      return null;
    }

    return composeFromHeader(settings.fromName || null, fromEmail);
  }

  private isProductionLike(): boolean {
    const env = (this.configService.get<string>('NODE_ENV') || '').toLowerCase();
    return env === 'production' || env === 'staging';
  }

  private normalizePage(page?: string): number {
    const parsed = Number.parseInt(page || '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return UserService.DEFAULT_PAGE;
    }
    return parsed;
  }

  private normalizeLimit(limit?: string): number {
    const parsed = Number.parseInt(limit || '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return UserService.DEFAULT_LIMIT;
    }
    return Math.min(parsed, UserService.MAX_LIMIT);
  }

  private normalizeSort(sort?: string): string {
    if (!sort) {
      return UserService.ALLOWED_USER_SORTS.get('name') as string;
    }
    const mappedSort = UserService.ALLOWED_USER_SORTS.get(sort);
    if (!mappedSort) {
      throw new BadRequestException(`Invalid sort column: ${sort}`);
    }
    return mappedSort;
  }

  private normalizeOrder(order?: string): 'ASC' | 'DESC' {
    if (!order) return 'ASC';
    const normalizedOrder = order.toUpperCase();
    if (normalizedOrder !== 'ASC' && normalizedOrder !== 'DESC') {
      throw new BadRequestException(`Invalid order: ${order}`);
    }
    return normalizedOrder;
  }

  private normalizeRole(role?: string): UserRole | undefined {
    if (!role) return undefined;
    if (role !== UserRole.ADMIN && role !== UserRole.RESIDENT) {
      throw new BadRequestException(`Invalid role filter: ${role}`);
    }
    return role;
  }

  private async sendOnboardingVerificationEmail(
    organizationId: string,
    userName: string,
    recipientEmail: string,
    plainToken: string,
  ): Promise<SendEmailResult> {
    const organizationFrom = await this.resolveOrganizationSenderFrom(organizationId);
    return this.emailService.send({
      to: [recipientEmail],
      from: organizationFrom || undefined,
      subject: 'Verify your email',
      text: [
        `Hello ${userName},`,
        '',
        `Use this token to verify your email: ${plainToken}`,
        'This token expires in 30 minutes.',
        '',
        'If you did not request this change, ignore this message.',
      ].join('\n'),
    });
  }

}
