import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

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
      const payload = {
        sub: '1',
        name: 'Test User',
        role: 'admin',
        organizationId: '9dd02335-74fa-487b-99f3-f3e6f9fba2af',
        exp: 9999999999,
      };
      const result = await strategy.validate(payload);
      expect(result).toEqual({
        id: '1',
        name: 'Test User',
        role: 'admin',
        organizationId: '9dd02335-74fa-487b-99f3-f3e6f9fba2af',
      });
    });

    it('should reject when organizationId is missing', async () => {
      await expect(
        strategy.validate({
          sub: '1',
          name: 'Test User',
          role: 'admin',
          exp: 9999999999,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when organizationId is invalid', async () => {
      await expect(
        strategy.validate({
          sub: '1',
          name: 'Test User',
          role: 'admin',
          organizationId: 'invalid-org-id',
          exp: 9999999999,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when role is invalid', async () => {
      await expect(
        strategy.validate({
          sub: '1',
          name: 'Test User',
          role: 'manager',
          organizationId: '9dd02335-74fa-487b-99f3-f3e6f9fba2af',
          exp: 9999999999,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
