import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_HOURS = 720;

export interface EmailReplyTokenPayload {
  messageId: string;
  organizationId: string;
  senderEmail: string;
  exp: number;
}

type EmailReplyTokenVerificationResult =
  | { valid: true; payload: EmailReplyTokenPayload }
  | { valid: false; reason: 'invalid' | 'expired' };

@Injectable()
export class EmailReplyTokenService {
  constructor(private readonly configService: ConfigService) {}

  generateReplyToken(input: {
    messageId: string;
    organizationId: string;
    senderEmail: string;
    exp?: number;
  }): string {
    const payload: EmailReplyTokenPayload = {
      messageId: input.messageId,
      organizationId: input.organizationId,
      senderEmail: input.senderEmail.trim().toLowerCase(),
      exp: input.exp ?? this.resolveDefaultExpirationEpochSeconds(),
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = this.sign(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  verifyReplyToken(token: string): EmailReplyTokenVerificationResult {
    const normalizedToken = token.trim();
    const split = normalizedToken.split('.');
    if (split.length !== 2) {
      return { valid: false, reason: 'invalid' };
    }

    const [encodedPayload, providedSignature] = split;
    if (!encodedPayload || !providedSignature) {
      return { valid: false, reason: 'invalid' };
    }

    const expectedSignature = this.sign(encodedPayload);
    if (!this.signaturesEqual(expectedSignature, providedSignature)) {
      return { valid: false, reason: 'invalid' };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      return { valid: false, reason: 'invalid' };
    }

    if (!this.isValidPayload(payload)) {
      return { valid: false, reason: 'invalid' };
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: 'expired' };
    }

    return {
      valid: true,
      payload: {
        ...payload,
        senderEmail: payload.senderEmail.trim().toLowerCase(),
      },
    };
  }

  buildReplyToAddress(baseAddress: string, token: string): string {
    const normalizedBaseAddress = baseAddress.trim().toLowerCase();
    const [localPart, domain] = normalizedBaseAddress.split('@');
    if (!localPart || !domain) {
      throw new Error('Invalid reply mailbox address');
    }

    const encodedToken = Buffer.from(token, 'utf8').toString('base64url');
    return `${localPart}+grillrent.${encodedToken}@${domain}`;
  }

  extractTokenFromReplyAddress(address: string): string | null {
    const normalizedAddress = address.trim();
    const [localPart] = normalizedAddress.split('@');
    if (!localPart) {
      return null;
    }

    const match = localPart.match(/\+grillrent\.([A-Za-z0-9_-]+)$/);
    if (!match?.[1]) {
      return null;
    }

    try {
      return Buffer.from(match[1], 'base64url').toString('utf8');
    } catch {
      return null;
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.resolveSecret())
      .update(payload, 'utf8')
      .digest('base64url');
  }

  private signaturesEqual(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private resolveSecret(): string {
    const secret = (this.configService.get<string>('CONTACT_EMAIL_REPLY_TOKEN_SECRET') || '').trim();
    if (!secret) {
      throw new Error('CONTACT_EMAIL_REPLY_TOKEN_SECRET is required');
    }
    return secret;
  }

  private resolveDefaultExpirationEpochSeconds(): number {
    const rawTtl = (this.configService.get<string>('CONTACT_EMAIL_REPLY_TOKEN_TTL_HOURS') || '').trim();
    const ttlHours = rawTtl ? Number(rawTtl) : DEFAULT_TTL_HOURS;
    if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
      throw new Error('CONTACT_EMAIL_REPLY_TOKEN_TTL_HOURS must be a positive number');
    }

    return Math.floor(Date.now() / 1000) + Math.floor(ttlHours * 3600);
  }

  private isValidPayload(value: unknown): value is EmailReplyTokenPayload {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.messageId === 'string'
      && candidate.messageId.trim().length > 0
      && typeof candidate.organizationId === 'string'
      && candidate.organizationId.trim().length > 0
      && typeof candidate.senderEmail === 'string'
      && candidate.senderEmail.trim().length > 0
      && typeof candidate.exp === 'number'
      && Number.isFinite(candidate.exp)
    );
  }
}
