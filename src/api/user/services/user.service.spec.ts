import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a user', async () => {
      const createUserDto = {
        name: 'testuser',
        password: 'password123',
        email: 'testuser@example.com',
        apartment: '101',
      };
      const user = { id: '1', ...createUserDto, password: 'hashedpassword' };
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedpassword' as never);
      jest.spyOn(repository, 'create').mockReturnValue(user as any);
      jest.spyOn(repository, 'save').mockResolvedValue(user as any);

      expect(await service.register(createUserDto)).toEqual(user);
    });

    it('should throw a ConflictException if name, email, or apartment already exists', async () => {
      const createUserDto = {
        name: 'testuser',
        password: 'password123',
        email: 'testuser@example.com',
        apartment: '101',
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(createUserDto as any);

      await expect(service.register(createUserDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginUserDto = {
        name: 'testuser',
        password: 'password123',
      };
      const user = { id: '1', ...loginUserDto, password: 'hashedpassword' };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      expect(await service.login(loginUserDto)).toEqual({ message: 'User logged in successfully', token: 'jwt-token' });
    });

    it('should throw an UnauthorizedException if credentials are invalid', async () => {
      const loginUserDto = {
        name: 'testuser',
        password: 'password123',
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.login(loginUserDto)).rejects.toThrow(UnauthorizedException);
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
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);

      expect(await service.getProfile('1')).toEqual({ message: 'User profile retrieved successfully', user });
    });

    it('should throw an UnauthorizedException if user is not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.getProfile('1')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const updateUserDto = {
        email: 'newemail@example.com',
        apartment: '102',
      };
      const user = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
      };
      const updatedUser = { ...user, ...updateUserDto };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);
      jest.spyOn(repository, 'save').mockResolvedValue(updatedUser as any);

      expect(await service.updateProfile('1', updateUserDto)).toEqual({ message: 'User profile updated successfully', user: updatedUser });
    });

    it('should throw an UnauthorizedException if user is not found', async () => {
      const updateUserDto = {
        email: 'newemail@example.com',
        apartment: '102',
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.updateProfile('1', updateUserDto)).rejects.toThrow(UnauthorizedException);
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
      }];
      jest.spyOn(repository, 'find').mockResolvedValue(users as any);

      expect(await service.getAllUsers()).toEqual({ message: 'All users retrieved successfully', users });
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
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);
      jest.spyOn(repository, 'remove').mockResolvedValue(user as any);

      expect(await service.remove('1')).toEqual({ message: 'User removed successfully' });
    });

    it('should throw a NotFoundException if user is not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });
});
