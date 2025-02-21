import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'testSecret' })],
      providers: [JwtStrategy],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the payload', async () => {
      const payload = { sub: '1', name: 'Test User', role: 'admin' };
      const result = await strategy.validate(payload);
      expect(result).toEqual({ id: '1', name: 'Test User', role: 'admin' });
    });
  });
});
