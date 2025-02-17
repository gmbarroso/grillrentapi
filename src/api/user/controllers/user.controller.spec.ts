import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from '../services/user.service';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { CreateUserDto, CreateUserSchema } from '../dto/create-user.dto';
import { LoginUserDto, LoginUserSchema } from '../dto/login-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { JoiValidationPipe } from '../../../shared/pipes/joi-validation.pipe';

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
            register: jest.fn(),
            login: jest.fn(),
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
    it('should register a user', async () => {
      const createUserDto: CreateUserDto = {
        name: 'testuser',
        password: 'password123', // 8 characters
        email: 'testuser@example.com',
        apartment: '101',
      };
      const user: User = { id: '1', ...createUserDto };
      const result = { message: 'User registered successfully', user };
      jest.spyOn(service, 'register').mockResolvedValue(user);

      const validationPipe = new JoiValidationPipe(CreateUserSchema);
      expect(await controller.register(validationPipe.transform(createUserDto, { type: 'body' }))).toEqual(result);
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginUserDto: LoginUserDto = {
        name: 'testuser',
        password: 'password123', // 8 characters
      };
      const result = { message: 'User logged in successfully', token: 'jwt-token' };
      jest.spyOn(service, 'login').mockResolvedValue(result);

      const validationPipe = new JoiValidationPipe(LoginUserSchema);
      expect(await controller.login(validationPipe.transform(loginUserDto, { type: 'body' }))).toBe(result);
    });
  });

  describe('getProfile', () => {
    it('should get user profile', async () => {
      const req = { user: { id: '1' } };
      const user: User = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'testuser@example.com',
        apartment: '101',
      };
      const result = { message: 'User profile retrieved successfully', user };
      jest.spyOn(service, 'getProfile').mockResolvedValue(result);

      expect(await controller.getProfile(req)).toBe(result);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const req = { user: { id: '1' } };
      const updateUserDto: UpdateUserDto = {
        email: 'newemail@example.com',
        apartment: '102',
      };
      const user: User = {
        id: '1',
        name: 'testuser',
        password: 'hashedpassword',
        email: 'newemail@example.com',
        apartment: '102',
      };
      const result = { message: 'User profile updated successfully', user };
      jest.spyOn(service, 'updateProfile').mockResolvedValue(result);

      expect(await controller.updateProfile(req, updateUserDto)).toBe(result);
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
      }];
      const result = { message: 'All users retrieved successfully', users };
      jest.spyOn(service, 'getAllUsers').mockResolvedValue(result);

      expect(await controller.getAllUsers()).toBe(result);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      const result = { message: 'User removed successfully' };
      jest.spyOn(service, 'remove').mockResolvedValue(result);

      expect(await controller.remove('1')).toBe(result);
    });
  });
});
