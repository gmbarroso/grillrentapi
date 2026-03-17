import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

type KeyStore = Record<string, string>;

function isProductionLike(configService: ConfigService): boolean {
  const env = (configService.get<string>('NODE_ENV') || '').toLowerCase();
  return env === 'production' || env === 'staging';
}

function parseKeyStore(configService: ConfigService): KeyStore {
  const raw = (configService.get<string>('ORG_SMTP_ENCRYPTION_KEYS_JSON') || '').trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entries = Object.entries(parsed || {}).filter(
      ([version, value]) => typeof version === 'string' && version.trim() && typeof value === 'string' && value.trim(),
    );
    return Object.fromEntries(entries.map(([version, value]) => [version.trim(), String(value).trim()]));
  } catch {
    return {};
  }
}

function rawKeyToBuffer(raw: string, configService: ConfigService): Buffer {
  if (!raw) {
    if (isProductionLike(configService)) {
      throw new Error('ORG_SMTP_ENCRYPTION_KEY is required in production/staging');
    }
    return createHash('sha256').update('local-dev-org-smtp-encryption-key').digest();
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  const decodedBase64 = Buffer.from(raw, 'base64');
  if (decodedBase64.length === 32) {
    return decodedBase64;
  }

  if (isProductionLike(configService)) {
    throw new Error('ORG_SMTP_ENCRYPTION_KEY must be a 32-byte key (base64) or 64-char hex');
  }

  return createHash('sha256').update('local-dev-org-smtp-encryption-key').digest();
}

function resolveRawKeyForVersion(configService: ConfigService, keyVersion?: string | null): string {
  const currentVersion = (configService.get<string>('ORG_SMTP_ENCRYPTION_KEY_VERSION') || 'v1').trim() || 'v1';
  const currentRaw = (configService.get<string>('ORG_SMTP_ENCRYPTION_KEY') || '').trim();
  const keyStore = parseKeyStore(configService);
  const requestedVersion = (keyVersion || currentVersion).trim();

  if (requestedVersion && keyStore[requestedVersion]) {
    return keyStore[requestedVersion];
  }

  if (!requestedVersion || requestedVersion === currentVersion) {
    return currentRaw;
  }

  return '';
}

export function getSmtpEncryptionKeyVersion(configService: ConfigService): string {
  return (configService.get<string>('ORG_SMTP_ENCRYPTION_KEY_VERSION') || 'v1').trim() || 'v1';
}

export function encryptOrganizationSmtpSecret(
  plainValue: string,
  configService: ConfigService,
): { encrypted: string; iv: string; authTag: string; keyVersion: string } {
  const keyVersion = getSmtpEncryptionKeyVersion(configService);
  const key = rawKeyToBuffer(resolveRawKeyForVersion(configService, keyVersion), configService);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainValue, 'utf8'), cipher.final()]);

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion,
  };
}

export function decryptOrganizationSmtpSecret(
  encryptedValue: string | null,
  ivValue: string | null,
  authTagValue: string | null,
  configService: ConfigService,
  keyVersion?: string | null,
): string | null {
  if (!encryptedValue || !ivValue || !authTagValue) {
    return null;
  }

  try {
    const key = rawKeyToBuffer(resolveRawKeyForVersion(configService, keyVersion), configService);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagValue, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
