import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../api/user/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from '../../../api/user/dto/login-user.dto';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let bcryptCompare: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
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

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    bcryptCompare = jest.fn();
    jest.spyOn(bcrypt, 'compare').mockImplementation(bcryptCompare);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user data if validation is successful', async () => {
      const user = { id: 1, username: 'testuser', password: await bcrypt.hash('password123', 10) } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);
      bcryptCompare.mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password123');
      expect(result).toEqual({ id: 1, username: 'testuser' });
    });

    it('should return null if validation fails', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      const result = await service.validateUser('testuser', 'password123');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token if login is successful', async () => {
      const user = { id: 1, username: 'testuser', password: await bcrypt.hash('password123', 10) } as User;
      jest.spyOn(service, 'validateUser').mockResolvedValue({ id: 1, username: 'testuser' });
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      const loginUserDto: LoginUserDto = { username: 'testuser', password: 'password123' };
      const result = await service.login(loginUserDto);
      expect(result).toEqual({ access_token: 'token' });
    });

    it('should throw UnauthorizedException if login fails', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      const loginUserDto: LoginUserDto = { username: 'testuser', password: 'password123' };
      await expect(service.login(loginUserDto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
