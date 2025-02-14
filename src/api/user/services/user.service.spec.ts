import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dto/create-user.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let bcryptCompare: jest.Mock;

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
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    bcryptCompare = jest.fn();
    jest.spyOn(bcrypt, 'compare').mockImplementation(bcryptCompare);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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

      const result = await service.register(createUserDto);
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

      const result = await service.login(loginUserDto);
      expect(result).toEqual({ message: 'User logged in successfully', token: 'token' });
    });

    it('should throw an error for invalid credentials', async () => {
      const loginUserDto: LoginUserDto = {
        username: 'testuser',
        password: 'wrongpassword',
      };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.login(loginUserDto)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getProfile', () => {
    it('should get user profile', async () => {
      const user = { id: 1, username: 'testuser', password: 'password123', email: 'testuser@example.com', apartment: '101' } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

      const result = await service.getProfile('1');
      expect(result).toEqual({ message: 'User profile retrieved successfully', user });
    });

    it('should throw an error if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getProfile('1')).rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const updateUserDto: UpdateUserDto = {
        email: 'newemail@example.com',
        apartment: '102',
      };
      const user = { id: 1, username: 'testuser', password: 'password123', email: 'testuser@example.com', apartment: '101' } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue({ ...user, ...updateUserDto });

      const result = await service.updateProfile('1', updateUserDto);
      expect(result).toEqual({ message: 'User profile updated successfully', user: { ...user, ...updateUserDto } });
    });

    it('should throw an error if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.updateProfile('1', {} as UpdateUserDto)).rejects.toThrow('User not found');
    });
  });
});
