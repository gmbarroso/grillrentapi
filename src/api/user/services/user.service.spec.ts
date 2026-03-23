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

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
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
              if (key === 'ORG_SMTP_ENCRYPTION_KEY') {
                return '';
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(UserService);
    userRepository = module.get(getRepositoryToken(User));
    organizationRepository = module.get(getRepositoryToken(Organization));
    organizationContactEmailSettingsRepository = module.get(getRepositoryToken(OrganizationContactEmailSettings));
    emailService = module.get(EmailService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('does not return reset token preview in production/staging', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') {
        return 'staging';
      }
      if (key === 'ORG_SMTP_ENCRYPTION_KEY') {
        return '';
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

  it('wires org SMTP repository dependency (sanity)', async () => {
    expect(organizationContactEmailSettingsRepository.findOne).not.toHaveBeenCalled();
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
});
