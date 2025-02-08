import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LocalAuthGuard } from '../auth/local-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should register a user', async () => {
    const user = { name: 'John Doe', email: 'john.doe@example.com', password: 'password123', apartment: '101' };
    jest.spyOn(userService, 'create').mockResolvedValue(user as any);
    expect(await controller.register(user)).toEqual(user);
  });

  it('should login a user', async () => {
    const user = { id: 1, email: 'john.doe@example.com' };
    const token = { access_token: 'token' };
    jest.spyOn(authService, 'login').mockResolvedValue(token as any);
    expect(await controller.login({ user })).toEqual(token);
  });

  it('should find all users', async () => {
    const users = [
      { id: 1, name: 'John Doe', email: 'john.doe@example.com', password: 'password123', apartment: '101' },
      { id: 2, name: 'Jane Doe', email: 'jane.doe@example.com', password: 'password123', apartment: '102' },
    ];
    jest.spyOn(userService, 'findAll').mockResolvedValue(users as any);
    expect(await controller.findAll()).toEqual(users);
  });

  it('should find one user by id', async () => {
    const user = { id: 1, name: 'John Doe', email: 'john.doe@example.com', password: 'password123', apartment: '101' };
    jest.spyOn(userService, 'findOne').mockResolvedValue(user as any);
    expect(await controller.findOne(1)).toEqual(user);
  });

  it('should update a user', async () => {
    const user = { id: 1, name: 'John Doe', email: 'john.doe@example.com', password: 'password123', apartment: '101' };
    const updatedUser = { name: 'John Updated' };
    jest.spyOn(userService, 'update').mockResolvedValue({ ...user, ...updatedUser } as any);
    expect(await controller.update(1, updatedUser)).toEqual({ ...user, ...updatedUser });
  });

  it('should remove a user', async () => {
    jest.spyOn(userService, 'remove').mockResolvedValue(undefined);
    expect(await controller.remove(1)).toBeUndefined();
  });
});
