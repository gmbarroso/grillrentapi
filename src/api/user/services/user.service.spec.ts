import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { UserService } from './user.service';
import { User, UserRole } from '../entities/user.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { OrganizationContactEmailSettings } from '../../message/entities/organization-contact-email-settings.entity';
import { EmailService } from '../../../shared/email/email.service';
import { ConfigService } from '@nestjs/config';
import { Booking } from '../../booking/entities/booking.entity';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let bookingRepository: jest.Mocked<Repository<Booking>>;
  let organizationRepository: jest.Mocked<Repository<Organization>>;
  let organizationContactEmailSettingsRepository: jest.Mocked<Repository<OrganizationContactEmailSettings>>;
  let emailService: jest.Mocked<EmailService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
            remove: jest.fn(),
            manager: {
              transaction: jest.fn(),
            },
          },
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: {
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrganizationContactEmailSettings),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: EmailService,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') {
                return 'development';
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(UserService);
    userRepository = module.get(getRepositoryToken(User));
    bookingRepository = module.get(getRepositoryToken(Booking));
    organizationRepository = module.get(getRepositoryToken(Organization));
    organizationContactEmailSettingsRepository = module.get(getRepositoryToken(OrganizationContactEmailSettings));
    emailService = module.get(EmailService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('applies resident listing query, pagination and verified-email priority ordering', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'user-1',
            name: 'Alice',
            email: 'alice@example.com',
            emailVerifiedAt: new Date('2026-01-01T10:00:00.000Z'),
            password: 'hashed',
            apartment: '101',
            block: 1,
            role: UserRole.RESIDENT,
            organizationId: 'org-1',
          },
        ],
        1,
      ]),
    };
    userRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

    const result = await service.getAllUsers('org-1', {
      q: 'alice',
      page: '2',
      limit: '20',
      sort: 'name',
      order: 'DESC',
      role: 'resident',
    });

    expect(queryBuilder.where).toHaveBeenCalledWith('user.organizationId = :organizationId', { organizationId: 'org-1' });
    expect(queryBuilder.take).toHaveBeenCalledWith(20);
    expect(queryBuilder.skip).toHaveBeenCalledWith(20);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.role = :role', { role: 'resident' });
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
      expect.stringContaining('user.emailVerifiedAt IS NOT NULL'),
      'ASC',
    );
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('user.name', 'DESC');
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
        }),
      ],
      total: 1,
      page: 2,
      lastPage: 1,
    });
  });

  it('returns generic forgot-password response when organization or email is missing', async () => {
    const result = await service.requestForgotPassword({
      organizationSlug: '   ',
      email: '',
    });

    expect(result).toEqual({
      message: 'If this account exists, reset instructions were sent.',
    });
  });

  it('returns generic forgot-password response when organization does not exist', async () => {
    organizationRepository.findOne.mockResolvedValue(null);

    const result = await service.requestForgotPassword({
      organizationSlug: 'condo-a',
      email: 'resident@example.com',
    });

    expect(result).toEqual({
      message: 'If this account exists, reset instructions were sent.',
    });
  });

  it('returns generic forgot-password response when user does not exist in organization', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      slug: 'condo-a',
      name: 'Condo A',
    } as Organization);
    userRepository.findOne.mockResolvedValue(null);

    const result = await service.requestForgotPassword({
      organizationSlug: 'condo-a',
      email: 'resident@example.com',
    });

    expect(result).toEqual({
      message: 'If this account exists, reset instructions were sent.',
    });
  });

  it('stores hashed reset token and returns preview in non-production-like env', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      slug: 'condo-a',
      name: 'Condo A',
    } as Organization);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      name: 'Resident',
      email: 'resident@example.com',
      role: UserRole.RESIDENT,
      password: 'hashed',
      organizationId: 'org-1',
    } as User);
    userRepository.save.mockImplementation(async (value) => value as User);

    const result = await service.requestForgotPassword({
      organizationSlug: 'condo-a',
      email: 'resident@example.com',
    });

    expect(result.message).toBe('If this account exists, reset instructions were sent.');
    expect(result.resetTokenPreview).toBeDefined();
    expect(result.resetTokenPreview?.length).toBe(64);

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordResetTokenHash: expect.any(String),
        passwordResetExpiresAt: expect.any(Date),
      }),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['resident@example.com'],
        subject: 'Password reset',
      }),
    );
  });

  it('uses organization fromEmail as sender when configured', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      slug: 'condo-a',
      name: 'Condo A',
    } as Organization);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      name: 'Resident',
      email: 'resident@example.com',
      role: UserRole.RESIDENT,
      password: 'hashed',
      organizationId: 'org-1',
    } as User);
    organizationContactEmailSettingsRepository.findOne.mockResolvedValue({
      organizationId: 'org-1',
      fromName: 'Condo Team',
      fromEmail: 'faleconosco.condo@seuze.tech',
    } as OrganizationContactEmailSettings);
    userRepository.save.mockImplementation(async (value) => value as User);

    await service.requestForgotPassword({
      organizationSlug: 'condo-a',
      email: 'resident@example.com',
    });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Condo Team <faleconosco.condo@seuze.tech>',
      }),
    );
  });

  it('does not return reset token preview in production/staging', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') {
        return 'staging';
      }
      return undefined;
    });
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      slug: 'condo-a',
      name: 'Condo A',
    } as Organization);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      name: 'Resident',
      email: 'resident@example.com',
      role: UserRole.RESIDENT,
      password: 'hashed',
      organizationId: 'org-1',
    } as User);
    userRepository.save.mockImplementation(async (value) => value as User);

    const result = await service.requestForgotPassword({
      organizationSlug: 'condo-a',
      email: 'resident@example.com',
    });

    expect(result).toEqual({
      message: 'If this account exists, reset instructions were sent.',
    });
  });

  it('throws on confirmForgotPassword when token lookup fails (invalid/expired)', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      slug: 'condo-a',
      name: 'Condo A',
    } as Organization);
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.confirmForgotPassword({
        organizationSlug: 'condo-a',
        token: 'abc123token',
        newPassword: 'Newpass1@',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('uses hashed token + expiration operator when confirming forgot password', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      slug: 'condo-a',
      name: 'Condo A',
    } as Organization);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      name: 'Resident',
      email: 'resident@example.com',
      role: UserRole.RESIDENT,
      password: '$2b$10$uAifFQDU8YXQxV0zt3ZqRO.X5v4a5vNQfTU7QY8MdkhN.9jI6cN9i',
      organizationId: 'org-1',
      passwordResetTokenHash: 'placeholder',
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
    } as User);
    userRepository.save.mockImplementation(async (value) => value as User);

    const token = 'abc123token';
    await service.confirmForgotPassword({
      organizationSlug: 'condo-a',
      token,
      newPassword: 'Newpass1@',
    });

    const expectedHash = createHash('sha256').update(token).digest('hex');
    const findOneArgs = userRepository.findOne.mock.calls[0][0] as {
      where: { organizationId: string; passwordResetTokenHash: string; passwordResetExpiresAt?: { _type?: string } };
    };
    expect(findOneArgs.where.organizationId).toBe('org-1');
    expect(findOneArgs.where.passwordResetTokenHash).toBe(expectedHash);
    expect(findOneArgs.where.passwordResetExpiresAt?._type).toBe('moreThan');
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        mustChangePassword: false,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      }),
    );
  });

  it('blocks email change through profile update flow', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      name: 'Resident',
      email: 'resident@example.com',
      role: UserRole.RESIDENT,
      password: 'hashed',
      apartment: '101',
      block: 1,
      organizationId: 'org-1',
    } as User);

    await expect(
      service.updateProfile(
        'user-1',
        { email: 'new@example.com' },
        { id: 'user-1', organizationId: 'org-1', role: UserRole.RESIDENT } as User,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires onboarding again when resident has pending email verification', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      name: 'Resident',
      email: 'resident@example.com',
      emailVerifiedAt: new Date('2026-03-20T10:00:00.000Z'),
      pendingEmail: 'new-email@example.com',
      mustChangePassword: false,
      role: UserRole.RESIDENT,
      apartment: '101',
      block: 1,
      organizationId: 'org-1',
    } as User);

    const result = await service.getProfile('user-1', 'org-1');
    expect(result.onboarding).toEqual({
      mustProvideEmail: false,
      mustVerifyEmail: true,
      mustChangePassword: false,
      onboardingRequired: true,
      isOnboardingComplete: false,
    });
  });

  it('marks first access tour as completed with max version semantics', async () => {
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    userRepository.createQueryBuilder.mockReturnValue(updateBuilder as any);

    userRepository.findOne
      .mockResolvedValueOnce({
        id: 'user-1',
        organizationId: 'org-1',
        role: UserRole.RESIDENT,
        firstAccessTourVersionCompleted: 2,
      } as User)
      .mockResolvedValueOnce({
        id: 'user-1',
        organizationId: 'org-1',
        role: UserRole.RESIDENT,
        firstAccessTourVersionCompleted: 2,
      } as User);

    const result = await service.completeFirstAccessTour('user-1', 'org-1', { version: 2 });
    expect(result).toEqual({
      message: 'First access tour marked as completed',
      tour: { firstAccessTourVersionCompleted: 2 },
    });

    await service.completeFirstAccessTour('user-1', 'org-1', { version: 1 });

    expect(updateBuilder.set).toHaveBeenCalledWith({
      firstAccessTourVersionCompleted: expect.any(Function),
    });
    const firstSetCall = updateBuilder.set.mock.calls[0][0];
    const expressionFactory = firstSetCall.firstAccessTourVersionCompleted as () => string;
    expect(expressionFactory()).toContain('"firstAccessTourVersionCompleted"');
    expect(updateBuilder.setParameters).toHaveBeenCalledWith({ requestedVersion: 1 });
    expect(updateBuilder.execute).toHaveBeenCalledTimes(2);
  });

  it('resets first access tour state', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      organizationId: 'org-1',
      role: UserRole.RESIDENT,
      firstAccessTourVersionCompleted: 3,
    } as User);
    userRepository.save.mockImplementation(async (value) => value as User);

    const result = await service.resetFirstAccessTour('user-1', 'org-1');
    expect(result).toEqual({
      message: 'First access tour reset successfully',
      tour: { firstAccessTourVersionCompleted: null },
    });
  });

  it('deletes user bookings before deleting user', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      organizationId: 'org-1',
      role: UserRole.RESIDENT,
    } as User);
    const transactionalEntityManager = {
      delete: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    (userRepository.manager.transaction as jest.Mock).mockImplementation(async (runInTransaction: any) =>
      runInTransaction(transactionalEntityManager),
    );

    const result = await service.remove('user-1', 'org-1');

    expect(transactionalEntityManager.delete).toHaveBeenCalledWith(Booking, { userId: 'user-1', organizationId: 'org-1' });
    expect(transactionalEntityManager.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', organizationId: 'org-1' }),
    );
    const deleteCallOrder = transactionalEntityManager.delete.mock.invocationCallOrder[0];
    const removeCallOrder = transactionalEntityManager.remove.mock.invocationCallOrder[0];
    expect(deleteCallOrder).toBeLessThan(removeCallOrder);
    expect(result).toEqual({ message: 'User removed successfully' });
  });

  it('throws not found when deleting a missing user', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.remove('missing-user', 'org-1')).rejects.toThrow('User not found');
    expect(userRepository.manager.transaction).not.toHaveBeenCalled();
  });
});
