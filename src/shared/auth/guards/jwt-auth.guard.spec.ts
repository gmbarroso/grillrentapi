import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('API JwtAuthGuard', () => {
  const API_PROTECTED_PATHS = ['/users/profile', '/users', '/resources', '/bookings', '/notices', '/messages'];
  const token = 'phase6-token';
  const revokedTokenRepository = {
    findOne: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string): string | undefined => {
      if (key === 'INTERNAL_SERVICE_TOKEN') return 'internal-secret';
      if (key === 'NODE_ENV') return 'production';
      return undefined;
    }),
  };
  const securityObservability = {
    recordAuthFailure: jest.fn(),
    recordRevocationDenial: jest.fn(),
    recordInternalTrustDenial: jest.fn(),
  };

  let guard: JwtAuthGuard;
  let parentCanActivateSpy: jest.SpyInstance;

  const orgId = '9dd02335-74fa-487b-99f3-f3e6f9fba2af';

  const createContext = (
    path: string,
    bearerToken?: string,
    internalToken = 'internal-secret',
    organizationId = orgId,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          url: path,
          headers: {
            ...(internalToken ? { 'x-internal-service-token': internalToken } : {}),
            ...(organizationId ? { 'x-organization-id': organizationId } : {}),
            ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
          },
        }),
      }),
    } as unknown as ExecutionContext);

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string): string | undefined => {
      if (key === 'INTERNAL_SERVICE_TOKEN') return 'internal-secret';
      if (key === 'NODE_ENV') return 'production';
      return undefined;
    });
    revokedTokenRepository.findOne.mockResolvedValue(null);
    guard = new JwtAuthGuard(revokedTokenRepository as any, configService as any, securityObservability as any);
    parentCanActivateSpy = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockResolvedValue(true as never);
  });

  afterEach(() => {
    parentCanActivateSpy.mockRestore();
  });

  it.each(API_PROTECTED_PATHS)('denies request with invalid internal token on %s', async (path) => {
    await expect(guard.canActivate(createContext(path, token, 'wrong-token'))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(securityObservability.recordInternalTrustDenial).toHaveBeenCalledWith(path);
  });

  it('allows local/test compatibility without internal token enforcement', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'local';
      if (key === 'INTERNAL_SERVICE_TOKEN') return undefined;
      return undefined;
    });
    guard = new JwtAuthGuard(revokedTokenRepository as any, configService as any, securityObservability as any);
    await expect(guard.canActivate(createContext('/users/profile', token, ''))).resolves.toBe(true);
  });

  it('enforces internal token when NODE_ENV is missing', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return undefined;
      if (key === 'INTERNAL_SERVICE_TOKEN') return undefined;
      return undefined;
    });
    guard = new JwtAuthGuard(revokedTokenRepository as any, configService as any, securityObservability as any);
    await expect(guard.canActivate(createContext('/users/profile', token, ''))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(securityObservability.recordInternalTrustDenial).toHaveBeenCalledWith('/users/profile');
  });

  it.each(API_PROTECTED_PATHS)('denies request without token on %s', async (path) => {
    await expect(guard.canActivate(createContext(path))).rejects.toThrow(UnauthorizedException);
    expect(securityObservability.recordAuthFailure).toHaveBeenCalledWith('token_not_provided', path);
  });

  it.each(API_PROTECTED_PATHS)('denies request without organization header on %s', async (path) => {
    await expect(guard.canActivate(createContext(path, token, 'internal-secret', ''))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it.each(API_PROTECTED_PATHS)('calls parent passport guard when token is present on %s', async (path) => {
    const context = createContext(path, token);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(parentCanActivateSpy).toHaveBeenCalledWith(context);
    expect(revokedTokenRepository.findOne).toHaveBeenCalledWith({ where: { token } });
  });

  it.each(API_PROTECTED_PATHS)('denies revoked token on %s', async (path) => {
    revokedTokenRepository.findOne.mockResolvedValue({ id: 'revoked-entry' });

    await expect(guard.canActivate(createContext(path, token))).rejects.toThrow(UnauthorizedException);
    expect(securityObservability.recordRevocationDenial).toHaveBeenCalledWith(path);
  });

  it('maps missing user to canonical auth error', () => {
    expect(() => guard.handleRequest(null, null, { message: 'jwt malformed' }, createContext('/users/profile', token))).toThrow(
      'Invalid or expired token',
    );
  });

  it('denies organization mismatch as forbidden', () => {
    const context = createContext('/users/profile', token, 'internal-secret', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(() =>
      guard.handleRequest(
        null,
        { id: '1', name: 'User', role: 'resident', organizationId: orgId },
        null,
        context,
      ),
    ).toThrow(ForbiddenException);
  });

  it('preserves invalid token payload error', () => {
    expect(() =>
      guard.handleRequest(null, null, { message: 'Invalid token payload' }, createContext('/users/profile', token)),
    ).toThrow(
      'Invalid token payload',
    );
  });

  it('maps err path to canonical auth error and records observability', () => {
    expect(() =>
      guard.handleRequest(new Error('jwt malformed'), null, null, createContext('/users/profile', token)),
    ).toThrow(
      'Invalid or expired token',
    );
    expect(securityObservability.recordAuthFailure).toHaveBeenCalledWith('invalid_or_expired_token', 'passport');
  });

  it('maps invalid token payload from err path and records observability', () => {
    expect(() =>
      guard.handleRequest(new Error('Invalid token payload'), null, null, createContext('/users/profile', token)),
    ).toThrow(
      'Invalid token payload',
    );
    expect(securityObservability.recordAuthFailure).toHaveBeenCalledWith('invalid_token_payload', 'passport');
  });
});
