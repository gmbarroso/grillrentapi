import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from '../services/user.service';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User, UserRole } from '../entities/user.entity';
import { ForbiddenException, GoneException } from '@nestjs/common';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            getProfile: jest.fn(),
            updateProfile: jest.fn(),
            getAllUsers: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should reject client-facing register because BFF owns auth ingress', async () => {
      await expect(controller.register()).rejects.toThrow(GoneException);
    });
  });

  describe('login', () => {
    it('should reject client-facing login because BFF owns auth ingress', async () => {
      await expect(controller.login()).rejects.toThrow(GoneException);
    });
  });

  describe('logout', () => {
    it('should reject client-facing logout because BFF owns auth ingress', async () => {
      await expect(controller.logout()).rejects.toThrow(GoneException);
    });
  });

  describe('getProfile', () => {
    it('should get user profile', async () => {
      const user: User = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
      };
      const result = { message: 'User profile retrieved successfully', user };
      jest.spyOn(service, 'getProfile').mockResolvedValue(result);

      expect(await controller.getProfile(user)).toBe(result);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const user: User = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
      };
      const updateUserDto: UpdateUserDto = {
        email: 'newemail@example.com',
        apartment: '102',
      };
      const updatedUser: User = {
        ...user,
        email: 'newemail@example.com',
        apartment: '102',
      };
      const result = { message: 'User profile updated successfully', user: updatedUser };
      jest.spyOn(service, 'updateProfile').mockResolvedValue(updatedUser as any);
      const req = { user } as any;

      expect(await controller.updateProfile(req, updateUserDto)).toEqual(result);
    });
  });

  describe('getAllUsers', () => {
    it('should get all users', async () => {
      const users: User[] = [{
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
      }];
      const result = { message: 'All users retrieved successfully', users };
      jest.spyOn(service, 'getAllUsers').mockResolvedValue(result);

      expect(await controller.getAllUsers({ organizationId: 'org-1' } as any)).toBe(result);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      const result = { message: 'User removed successfully' };
      jest.spyOn(service, 'remove').mockResolvedValue(result);

      const currentUser: User = {
        id: '1',
        name: 'adminuser',
        password: 'hashedpassword',
        email: 'admin@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.ADMIN,
      };

      expect(await controller.remove(currentUser, '1')).toBe(result);
    });

    it('should return an error if user is not admin', async () => {
      const currentUser: User = {
        id: '1',
        name: 'residentuser',
        password: 'hashedpassword',
        email: 'resident@example.com',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
      };

      await expect(controller.remove(currentUser, '1')).rejects.toThrow(ForbiddenException);
    });
  });
});
