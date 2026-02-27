import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const API_PROTECTED_PATHS = ['/users/profile', '/users', '/resources', '/bookings', '/notices'];
  const token = 'phase2-token';

  let guard: JwtAuthGuard;
  let authService: { isTokenRevoked: jest.Mock };
  let parentCanActivateSpy: jest.SpyInstance;

  const createContext = (path: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          url: path,
          headers: { authorization: `Bearer ${token}` },
        }),
      }),
    } as unknown as ExecutionContext);

  beforeEach(() => {
    authService = {
      isTokenRevoked: jest.fn(),
    };
    guard = new JwtAuthGuard(authService as any);
    parentCanActivateSpy = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockResolvedValue(true as never);
  });

  afterEach(() => {
    parentCanActivateSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it.each(API_PROTECTED_PATHS)('allows token before logout on %s', async (path) => {
      authService.isTokenRevoked.mockResolvedValue(false);
      const context = createContext(path);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(authService.isTokenRevoked).toHaveBeenCalledWith(token);
      expect(parentCanActivateSpy).toHaveBeenCalledWith(context);
    });

    it.each(API_PROTECTED_PATHS)('denies token after logout on %s', async (path) => {
      authService.isTokenRevoked.mockResolvedValue(true);

      await expect(guard.canActivate(createContext(path))).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(createContext(path))).rejects.toThrow('Token has been revoked');
    });

    it.each(API_PROTECTED_PATHS)(
      'post-cleanup, expired token without revoked record remains denied on %s',
      async (path) => {
        authService.isTokenRevoked.mockResolvedValue(false);
        parentCanActivateSpy.mockRejectedValue(new UnauthorizedException('jwt expired'));

        await expect(guard.canActivate(createContext(path))).rejects.toThrow('jwt expired');
        expect(authService.isTokenRevoked).toHaveBeenCalledWith(token);
      },
    );
  });

  describe('handleRequest', () => {
    it('should return user if no error and user is present', () => {
      const user = { id: 1, name: 'testuser' };
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
