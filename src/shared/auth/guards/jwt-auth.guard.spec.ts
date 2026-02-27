import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('API JwtAuthGuard', () => {
  const API_PROTECTED_PATHS = ['/users/profile', '/users', '/resources', '/bookings', '/notices'];
  const token = 'phase6-token';

  let guard: JwtAuthGuard;
  let parentCanActivateSpy: jest.SpyInstance;

  const createContext = (path: string, bearerToken?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          url: path,
          headers: bearerToken ? { authorization: `Bearer ${bearerToken}` } : {},
        }),
      }),
    } as unknown as ExecutionContext);

  beforeEach(() => {
    guard = new JwtAuthGuard();
    parentCanActivateSpy = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockResolvedValue(true as never);
  });

  afterEach(() => {
    parentCanActivateSpy.mockRestore();
  });

  it.each(API_PROTECTED_PATHS)('denies request without token on %s', async (path) => {
    await expect(guard.canActivate(createContext(path))).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(createContext(path))).rejects.toThrow('Token not provided');
  });

  it.each(API_PROTECTED_PATHS)('calls parent passport guard when token is present on %s', async (path) => {
    const context = createContext(path, token);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(parentCanActivateSpy).toHaveBeenCalledWith(context);
  });

  it('maps missing user to canonical auth error', () => {
    expect(() => guard.handleRequest(null, null, { message: 'jwt malformed' })).toThrow(
      'Invalid or expired token',
    );
  });

  it('preserves invalid token payload error', () => {
    expect(() => guard.handleRequest(null, null, { message: 'Invalid token payload' })).toThrow(
      'Invalid token payload',
    );
  });
});
