import { resolveJwtSecret } from './jwt-secret.policy';

describe('resolveJwtSecret', () => {
  it('returns trimmed secret when provided', () => {
    expect(resolveJwtSecret('  prod-secret  ', 'production')).toBe('prod-secret');
  });

  it('returns local fallback for test env when secret is missing', () => {
    expect(resolveJwtSecret(undefined, 'test')).toBe('local-dev-jwt-secret');
  });

  it('returns local fallback for development env when secret is missing', () => {
    expect(resolveJwtSecret(undefined, 'development')).toBe('local-dev-jwt-secret');
  });

  it('throws in production when secret is missing', () => {
    expect(() => resolveJwtSecret(undefined, 'production')).toThrow(
      'JWT_SECRET is required when NODE_ENV=production',
    );
  });
});
