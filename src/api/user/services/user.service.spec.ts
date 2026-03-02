import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
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
