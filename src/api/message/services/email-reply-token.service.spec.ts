import { ConfigService } from '@nestjs/config';
import { EmailReplyTokenService } from './email-reply-token.service';

describe('EmailReplyTokenService', () => {
  let service: EmailReplyTokenService;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'CONTACT_EMAIL_REPLY_TOKEN_SECRET') return 'token-secret';
        if (key === 'CONTACT_EMAIL_REPLY_TOKEN_TTL_HOURS') return '720';
        return null;
      }),
    };

    service = new EmailReplyTokenService(configService as unknown as ConfigService);
  });

  it('generates and verifies reply token', () => {
    const messageId = '11111111-1111-4111-8111-111111111111';
    const organizationId = '22222222-2222-4222-8222-222222222222';
    const senderEmail = 'Resident@Example.com';
    const token = service.generateReplyToken({
      messageId,
      organizationId,
      senderEmail,
    });

    expect(token.length).toBeLessThanOrEqual(43);
    const decoded = service.verifyReplyToken(token);
    expect(decoded.valid).toBe(true);
    if (!decoded.valid) return;
    expect(decoded.payload.messageId).toBe(messageId);

    const verification = service.verifyCompactTokenAgainstContext(token, {
      organizationId,
      senderEmail,
    });
    expect(verification).toEqual({ valid: true, messageId });
  });

  it('rejects tampered token', () => {
    const messageId = '11111111-1111-4111-8111-111111111111';
    const organizationId = '22222222-2222-4222-8222-222222222222';
    const senderEmail = 'resident@example.com';
    const token = service.generateReplyToken({
      messageId,
      organizationId,
      senderEmail,
    });

    const tamperedBytes = Buffer.from(token, 'base64url');
    tamperedBytes[0] = tamperedBytes[0] ^ 0xff;
    const tampered = tamperedBytes.toString('base64url');
    const verification = service.verifyCompactTokenAgainstContext(tampered, {
      organizationId,
      senderEmail,
    });
    expect(verification).toEqual({ valid: false, reason: 'invalid' });
  });

  it('rejects expired token', () => {
    const token = service.generateReplyToken({
      messageId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'resident@example.com',
      exp: Math.floor(Date.now() / 1000) - 10,
    });

    const verification = service.verifyReplyToken(token);
    expect(verification).toEqual({ valid: false, reason: 'expired' });
  });

  it('builds and extracts token from plus-address', () => {
    const token = service.generateReplyToken({
      messageId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'resident@example.com',
    });
    const replyAddress = service.buildReplyToAddress('faleconosco@example.com', token);

    expect(replyAddress.startsWith('faleconosco+gr.')).toBe(true);
    expect(service.extractTokenFromReplyAddress(replyAddress)).toBe(token);
    expect(service.extractTokenFromReplyAddress(`"Contact" <${replyAddress}>`)).toBe(token);
  });

  it('accepts legacy +grillrent token format for backward compatibility', () => {
    const token = service.generateReplyToken({
      messageId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'resident@example.com',
    });

    const legacyAddress = `faleconosco+grillrent.${token}@example.com`;
    expect(service.extractTokenFromReplyAddress(legacyAddress)).toBe(token);
  });
});
