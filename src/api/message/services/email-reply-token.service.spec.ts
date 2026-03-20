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
    const token = service.generateReplyToken({
      messageId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'Resident@Example.com',
    });

    const verification = service.verifyReplyToken(token);
    expect(verification.valid).toBe(true);
    if (!verification.valid) return;

    expect(verification.payload.messageId).toBe('11111111-1111-4111-8111-111111111111');
    expect(verification.payload.organizationId).toBe('22222222-2222-4222-8222-222222222222');
    expect(verification.payload.senderEmail).toBe('resident@example.com');
  });

  it('rejects tampered token', () => {
    const token = service.generateReplyToken({
      messageId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      senderEmail: 'resident@example.com',
    });

    const tampered = `${token.slice(0, -1)}x`;
    const verification = service.verifyReplyToken(tampered);
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

    expect(replyAddress.startsWith('faleconosco+grillrent.')).toBe(true);
    expect(service.extractTokenFromReplyAddress(replyAddress)).toBe(token);
  });
});
