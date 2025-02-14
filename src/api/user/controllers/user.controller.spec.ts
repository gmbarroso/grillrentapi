import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let bcryptCompare: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    bcryptCompare = jest.fn();
    jest.spyOn(bcrypt, 'compare').mockImplementation(bcryptCompare);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a user', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        email: 'testuser@example.com',
        apartment: '101',
      };
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      const user = { ...createUserDto, password: hashedPassword, id: 1 } as User;
      jest.spyOn(userRepository, 'create').mockReturnValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);

      const result = await controller.register(createUserDto);
      expect(result).toEqual({ message: 'User registered successfully', user });
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginUserDto: LoginUserDto = {
        username: 'testuser',
        password: 'password123',
      };
      const user = { id: 1, username: 'testuser', password: await bcrypt.hash('password123', 10) } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);
      bcryptCompare.mockResolvedValue(true);
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      const result = await controller.login(loginUserDto);
      expect(result).toEqual({ message: 'User logged in successfully', token: 'token' });
    });

    it('should throw an error for invalid credentials', async () => {
      const loginUserDto: LoginUserDto = {
        username: 'testuser',
        password: 'wrongpassword',
      };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(controller.login(loginUserDto)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getProfile', () => {
    it('should get user profile', async () => {
      const req = { user: { id: 1 } };
      const user = { id: 1, username: 'testuser', password: 'password123', email: 'testuser@example.com', apartment: '101' } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

      const result = await controller.getProfile(req);
      expect(result).toEqual({ message: 'User profile retrieved successfully', user });
    });

    it('should throw an error if user not found', async () => {
      const req = { user: { id: 1 } };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(controller.getProfile(req)).rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const req = { user: { id: 1 } };
      const updateUserDto: UpdateUserDto = {
        email: 'newemail@example.com',
        apartment: '102',
      };
      const user = { id: 1, username: 'testuser', password: 'password123', email: 'testuser@example.com', apartment: '101' } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue({ ...user, ...updateUserDto });

      const result = await controller.updateProfile(req, updateUserDto);
      expect(result).toEqual({ message: 'User profile updated successfully', user: { ...user, ...updateUserDto } });
    });

    it('should throw an error if user not found', async () => {
      const req = { user: { id: 1 } };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(controller.updateProfile(req, {} as UpdateUserDto)).rejects.toThrow('User not found');
    });
  });
});
