import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto';

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should get user profile without sensitive fields', async () => {
      const user = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
        mustChangePassword: false,
        emailVerifiedAt: new Date(),
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);

      const result = await service.getProfile('1', '9dd02335-74fa-487b-99f3-f3e6f9fba2af');
      expect(result.message).toBe('User profile retrieved successfully');
      expect(result.user).not.toHaveProperty('password');
      expect(result.onboarding).toEqual(
        expect.objectContaining({
          onboardingRequired: false,
          isOnboardingComplete: true,
        }),
      );
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
        mustChangePassword: true,
      };
      const updatedUser = { ...user, pendingEmail: 'newemail@example.com' };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);
      jest.spyOn(repository, 'save').mockResolvedValue(updatedUser as any);

      const result = await service.updateProfile('1', updateUserDto, user);
      expect(result.message).toBe('User profile updated successfully');
      expect(result.user).not.toHaveProperty('password');
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
        mustChangePassword: true,
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
        mustChangePassword: true,
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);

      await expect(service.updateProfile('1', updateUserDto, user)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAllUsers', () => {
    it('should get all users without sensitive fields', async () => {
      const users = [{
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
        mustChangePassword: false,
      }];
      jest.spyOn(repository, 'find').mockResolvedValue(users as any);

      const result = await service.getAllUsers('9dd02335-74fa-487b-99f3-f3e6f9fba2af');
      expect(result.message).toBe('All users retrieved successfully');
      expect(result.users).toHaveLength(1);
      expect(result.users[0]).not.toHaveProperty('password');
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

  describe('changeOnboardingPassword', () => {
    it('should reject when current password is wrong', async () => {
      const user = {
        id: '1',
        name: 'Resident',
        role: UserRole.RESIDENT,
        organizationId: 'org-1',
        password: '$2b$10$uAifFQDU8YXQxV0zt3ZqRO.X5v4a5vNQfTU7QY8MdkhN.9jI6cN9i', // "Password1"
        email: null,
        mustChangePassword: true,
      } as User;
      jest.spyOn(repository, 'findOne').mockResolvedValue(user);

      await expect(
        service.changeOnboardingPassword('1', 'org-1', { currentPassword: 'Wrong123', newPassword: 'Newpass123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
