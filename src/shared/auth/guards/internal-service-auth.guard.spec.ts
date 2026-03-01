import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalServiceAuthGuard } from './internal-service-auth.guard';

describe('InternalServiceAuthGuard', () => {
  const securityObservability = {
    recordInternalTrustDenial: jest.fn(),
  };

  const createContext = (url: string, internalToken?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          url,
          headers: {
            ...(internalToken ? { 'x-internal-service-token': internalToken } : {}),
          },
        }),
      }),
    } as unknown as ExecutionContext);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bypasses validation in local env', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'local';
        if (key === 'INTERNAL_SERVICE_TOKEN') return undefined;
        return undefined;
      }),
    };

    const guard = new InternalServiceAuthGuard(configService as any, securityObservability as any);
    expect(guard.canActivate(createContext('/organizations'))).toBe(true);
  });

  it('throws 401 when token is required but not configured', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'INTERNAL_SERVICE_TOKEN') return undefined;
        return undefined;
      }),
    };

    const guard = new InternalServiceAuthGuard(configService as any, securityObservability as any);
    expect(() => guard.canActivate(createContext('/organizations', 'x'))).toThrow(UnauthorizedException);
    expect(securityObservability.recordInternalTrustDenial).toHaveBeenCalledWith('/organizations');
  });

  it('throws 401 and records denial when token is invalid', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'INTERNAL_SERVICE_TOKEN') return 'internal-secret';
        return undefined;
      }),
    };

    const guard = new InternalServiceAuthGuard(configService as any, securityObservability as any);
    expect(() => guard.canActivate(createContext('/organizations', 'wrong-token'))).toThrow(UnauthorizedException);
    expect(securityObservability.recordInternalTrustDenial).toHaveBeenCalledWith('/organizations');
  });

  it('allows request when internal token matches', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'INTERNAL_SERVICE_TOKEN') return 'internal-secret';
        return undefined;
      }),
    };

    const guard = new InternalServiceAuthGuard(configService as any, securityObservability as any);
    expect(guard.canActivate(createContext('/organizations', 'internal-secret'))).toBe(true);
  });
});
