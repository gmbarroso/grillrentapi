import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        JwtModule.register({
          secret: process.env.JWT_SECRET || 'defaultSecretKey',
          signOptions: { expiresIn: '60s' },
        }),
      ],
      providers: [JwtStrategy],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the payload', async () => {
      const payload = { sub: 1, username: 'testuser' };
      const result = await strategy.validate(payload);
      expect(result).toEqual({ id: payload.sub, username: payload.username });
    });
  });
});
