import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_HOURS = 720;
const COMPACT_TOKEN_MAC_BYTES_LENGTH = 10;
const COMPACT_TOKEN_BYTES_LENGTH = 16 + 4 + COMPACT_TOKEN_MAC_BYTES_LENGTH;
const SHORT_PLUS_TAG = 'gr';

export interface EmailReplyTokenPayload {
  messageId: string;
  organizationId: string;
  senderEmail: string;
  exp: number;
}

interface CompactReplyTokenPayload {
  messageId: string;
  exp: number;
  mac: Buffer;
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
    const normalizedSenderEmail = input.senderEmail.trim().toLowerCase();
    const exp = input.exp ?? this.resolveDefaultExpirationEpochSeconds();
    const messageIdBytes = this.uuidToBytes(input.messageId);
    const expBytes = Buffer.alloc(4);
    expBytes.writeUInt32BE(exp, 0);
    const mac = this.computeCompactMac({
      messageId: input.messageId,
      organizationId: input.organizationId,
      senderEmail: normalizedSenderEmail,
      exp,
    });

    const tokenBytes = Buffer.concat([messageIdBytes, expBytes, mac]);
    return tokenBytes.toString('base64url');
  }

  verifyReplyToken(token: string): EmailReplyTokenVerificationResult {
    const normalizedToken = token.trim();
    const compact = this.decodeCompactReplyToken(normalizedToken);
    if (compact.valid) {
      return {
        valid: true,
        payload: {
          messageId: compact.payload.messageId,
          organizationId: '',
          senderEmail: '',
          exp: compact.payload.exp,
        },
      };
    }
    if (compact.reason === 'expired') {
      return { valid: false, reason: 'expired' };
    }
    if (!normalizedToken.includes('.')) {
      return { valid: false, reason: 'invalid' };
    }

    // Legacy format support for already-sent outbound emails.
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

    const plusLocalPart = `${localPart}+${SHORT_PLUS_TAG}.${token}`;
    if (plusLocalPart.length > 64) {
      throw new Error('Reply token local-part exceeds 64 characters');
    }

    return `${plusLocalPart}@${domain}`;
  }

  extractTokenFromReplyAddress(address: string): string | null {
    const mailbox = this.extractMailboxAddress(address);
    if (!mailbox) {
      return null;
    }

    const atIndex = mailbox.lastIndexOf('@');
    if (atIndex === -1) {
      return null;
    }

    const localPart = mailbox.slice(0, atIndex);
    if (!localPart) {
      return null;
    }

    const match = localPart.match(/\+(?:gr|grillrent)\.([A-Za-z0-9._-]+)$/i);
    if (!match?.[1]) {
      return null;
    }

    return match[1];
  }

  verifyCompactTokenAgainstContext(
    token: string,
    context: { organizationId: string; senderEmail: string },
  ): { valid: true; messageId: string } | { valid: false; reason: 'invalid' | 'expired' } {
    const decoded = this.decodeCompactReplyToken(token);
    if (!decoded.valid) {
      return decoded;
    }

    const expectedMac = this.computeCompactMac({
      messageId: decoded.payload.messageId,
      organizationId: context.organizationId,
      senderEmail: context.senderEmail.trim().toLowerCase(),
      exp: decoded.payload.exp,
    });

    if (!this.buffersEqual(expectedMac, decoded.payload.mac)) {
      return { valid: false, reason: 'invalid' };
    }

    return { valid: true, messageId: decoded.payload.messageId };
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.resolveSecret())
      .update(payload, 'utf8')
      .digest('base64url');
  }

  private signaturesEqual(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    return this.buffersEqual(expectedBuffer, providedBuffer);
  }

  private buffersEqual(expected: Buffer, provided: Buffer): boolean {
    if (expected.length !== provided.length) {
      return false;
    }
    return timingSafeEqual(expected, provided);
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

  private decodeCompactReplyToken(
    token: string,
  ): { valid: true; payload: CompactReplyTokenPayload } | { valid: false; reason: 'invalid' | 'expired' } {
    let tokenBytes: Buffer;
    try {
      tokenBytes = Buffer.from(token, 'base64url');
    } catch {
      return { valid: false, reason: 'invalid' };
    }

    if (tokenBytes.length !== COMPACT_TOKEN_BYTES_LENGTH) {
      return { valid: false, reason: 'invalid' };
    }

    const messageIdBytes = tokenBytes.subarray(0, 16);
    const expBytes = tokenBytes.subarray(16, 20);
    const mac = tokenBytes.subarray(20, 20 + COMPACT_TOKEN_MAC_BYTES_LENGTH);

    const exp = expBytes.readUInt32BE(0);
    if (exp <= Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: 'expired' };
    }

    let messageId: string;
    try {
      messageId = this.bytesToUuid(messageIdBytes);
    } catch {
      return { valid: false, reason: 'invalid' };
    }

    return {
      valid: true,
      payload: {
        messageId,
        exp,
        mac,
      },
    };
  }

  private computeCompactMac(input: {
    messageId: string;
    organizationId: string;
    senderEmail: string;
    exp: number;
  }): Buffer {
    const body = `${input.messageId}|${input.organizationId}|${input.senderEmail}|${input.exp}`;
    return createHmac('sha256', this.resolveSecret())
      .update(body, 'utf8')
      .digest()
      .subarray(0, COMPACT_TOKEN_MAC_BYTES_LENGTH);
  }

  private uuidToBytes(value: string): Buffer {
    const normalized = value.replace(/-/g, '');
    if (!/^[0-9a-fA-F]{32}$/.test(normalized)) {
      throw new Error('Invalid UUID');
    }
    return Buffer.from(normalized, 'hex');
  }

  private bytesToUuid(value: Buffer): string {
    if (value.length !== 16) {
      throw new Error('Invalid UUID bytes');
    }
    const hex = value.toString('hex');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }

  private extractMailboxAddress(value: string): string | null {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const angleMatch = normalized.match(/<([^<>@\s]+@[^<>@\s]+)>/);
    if (angleMatch?.[1]) {
      return angleMatch[1].trim();
    }

    const mailboxMatch = normalized.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/);
    if (mailboxMatch?.[0]) {
      return mailboxMatch[0].trim();
    }

    return null;
  }
}
