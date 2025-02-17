import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../../../api/user/services/user.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../api/user/entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

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
            sign: jest.fn().mockReturnValue('jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user data if validation is successful', async () => {
      const user: User = {
        id: '1',
        name: 'testuser',
        email: 'testuser@example.com',
        password: 'hashedpassword',
        apartment: 'A1',
      };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.validateUser('testuser', 'password123'); // 8 characters
      expect(result).toEqual({ id: '1', name: 'testuser', email: 'testuser@example.com', apartment: 'A1' });
    });

    it('should return null if validation fails', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null as any);

      const result = await service.validateUser('testuser', 'password123'); // 8 characters
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token if login is successful', async () => {
      const user: User = {
        id: '1',
        name: 'testuser',
        email: 'testuser@example.com',
        password: 'hashedpassword',
        apartment: 'A1',
      };
      jest.spyOn(service, 'validateUser').mockResolvedValue(user as any);

      const result = await service.login({ name: 'testuser', password: 'password123' }); // 8 characters
      expect(result).toEqual({ access_token: 'jwt-token' });
    });

    it('should throw UnauthorizedException if login fails', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null as any);

      await expect(service.login({ name: 'testuser', password: 'password123' })).rejects.toThrow(UnauthorizedException);
    });
  });
});
