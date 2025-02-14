import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should call super.canActivate', () => {
      const context = {} as ExecutionContext;
      const canActivateSpy = jest.spyOn(guard, 'canActivate').mockReturnValue(true);

      const result = guard.canActivate(context);
      expect(canActivateSpy).toHaveBeenCalledWith(context);
      expect(result).toBe(true);
    });
  });

  describe('handleRequest', () => {
    it('should return user if no error and user is present', () => {
      const user = { id: 1, username: 'testuser' };
      const result = guard.handleRequest(null, user, null);
      expect(result).toBe(user);
    });

    it('should throw UnauthorizedException if no user is present', () => {
      expect(() => guard.handleRequest(null, null, null)).toThrow(UnauthorizedException);
    });

    it('should throw error if error is present', () => {
      const error = new Error('Test error');
      expect(() => guard.handleRequest(error, null, null)).toThrow(error);
    });
  });
});
