const LOCAL_ENVIRONMENTS = new Set(['local', 'development', 'dev', 'test']);
const LOCAL_FALLBACK_JWT_SECRET = 'local-dev-jwt-secret';

export function resolveJwtSecret(
  jwtSecret = process.env.JWT_SECRET,
  nodeEnv = process.env.NODE_ENV,
): string {
  const normalizedSecret = jwtSecret?.trim();
  if (normalizedSecret) {
    return normalizedSecret;
  }

  const normalizedEnv = (nodeEnv ?? 'development').toLowerCase();
  if (LOCAL_ENVIRONMENTS.has(normalizedEnv)) {
    return LOCAL_FALLBACK_JWT_SECRET;
  }

  throw new Error(`JWT_SECRET is required when NODE_ENV=${normalizedEnv}`);
}

