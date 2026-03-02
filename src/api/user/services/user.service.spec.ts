import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConflictException, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ConfigService } from '@nestjs/config';

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'DEFAULT_ORGANIZATION_ID') return '9dd02335-74fa-487b-99f3-f3e6f9fba2af';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws when DEFAULT_ORGANIZATION_ID is missing in production-like env', () => {
    const missingInProductionConfig = {
      get: jest.fn((key: string) => {
        if (key === 'DEFAULT_ORGANIZATION_ID') return undefined;
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }),
    };

    expect(() => new UserService({} as Repository<User>, missingInProductionConfig as any)).toThrow(
      'DEFAULT_ORGANIZATION_ID must be configured in non-local environments',
    );
  });

  it('falls back to seeded org id when DEFAULT_ORGANIZATION_ID is missing in local-like env', () => {
    const missingInTestConfig = {
      get: jest.fn((key: string) => {
        if (key === 'DEFAULT_ORGANIZATION_ID') return undefined;
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      }),
    };

    const localService = new UserService({} as Repository<User>, missingInTestConfig as any);
    expect((localService as any).defaultOrganizationId).toBe('9dd02335-74fa-487b-99f3-f3e6f9fba2af');
  });

  it('throws when DEFAULT_ORGANIZATION_ID is not a valid UUID', () => {
    const invalidDefaultConfig = {
      get: jest.fn((key: string) => {
        if (key === 'DEFAULT_ORGANIZATION_ID') return 'invalid';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }),
    };

    expect(() => new UserService({} as Repository<User>, invalidDefaultConfig as any)).toThrow(
      'DEFAULT_ORGANIZATION_ID must be a valid UUID',
    );
  });

  describe('register', () => {
    it('should register a user', async () => {
      const createUserDto: CreateUserDto = {
        name: 'testuser',
        password: 'password123',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
      };
      const user: User = { id: '1', organizationId: '9dd02335-74fa-487b-99f3-f3e6f9fba2af', ...createUserDto };
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedpassword' as never);
      jest.spyOn(repository, 'create').mockReturnValue(user as any);
      jest.spyOn(repository, 'save').mockResolvedValue(user as any);

      expect(await service.register(createUserDto)).toEqual(user);
    });

    it('should throw a ConflictException if name, email, or apartment already exists', async () => {
      const createUserDto: CreateUserDto = {
        name: 'testuser',
        password: 'password123',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(createUserDto as any);

      await expect(service.register(createUserDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getProfile', () => {
    it('should get user profile', async () => {
      const user = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);

      expect(await service.getProfile('1', '9dd02335-74fa-487b-99f3-f3e6f9fba2af')).toEqual({ message: 'User profile retrieved successfully', user });
    });

    it('should throw an UnauthorizedException if user is not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.getProfile('1', '9dd02335-74fa-487b-99f3-f3e6f9fba2af')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const updateUserDto: UpdateUserDto = {
        name: 'newname',
        email: 'newemail@example.com',
      };
      const user: User = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
        organizationId: '9dd02335-74fa-487b-99f3-f3e6f9fba2af',
      };
      const updatedUser = { ...user, ...updateUserDto };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);
      jest.spyOn(repository, 'save').mockResolvedValue(updatedUser as any);

      expect(await service.updateProfile('1', updateUserDto, user)).toEqual({ message: 'User profile updated successfully', user: updatedUser });
    });

    it('should throw an UnauthorizedException if user is not found', async () => {
      const updateUserDto: UpdateUserDto = {
        email: 'newemail@example.com',
        apartment: '102',
      };
      const currentUser: User = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
        organizationId: '9dd02335-74fa-487b-99f3-f3e6f9fba2af',
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.updateProfile('1', updateUserDto, currentUser)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw a ForbiddenException if resident tries to update apartment or block', async () => {
      const updateUserDto: UpdateUserDto = {
        apartment: '102',
        block: 2,
      };
      const user: User = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
        organizationId: '9dd02335-74fa-487b-99f3-f3e6f9fba2af',
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);

      await expect(service.updateProfile('1', updateUserDto, user)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAllUsers', () => {
    it('should get all users', async () => {
      const users = [{
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
      }];
      jest.spyOn(repository, 'find').mockResolvedValue(users as any);

      expect(await service.getAllUsers('9dd02335-74fa-487b-99f3-f3e6f9fba2af')).toEqual({ message: 'All users retrieved successfully', users });
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      const user = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);
      jest.spyOn(repository, 'remove').mockResolvedValue(user as any);

      expect(await service.remove('1', '9dd02335-74fa-487b-99f3-f3e6f9fba2af')).toEqual({ message: 'User removed successfully' });
    });

    it('should throw a NotFoundException if user is not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('1', '9dd02335-74fa-487b-99f3-f3e6f9fba2af')).rejects.toThrow(NotFoundException);
    });
  });
});
