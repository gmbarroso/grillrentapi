import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailService } from './email.service';

jest.mock('resend', () => ({
  Resend: jest.fn(),
}));

describe('EmailService', () => {
  const mockResendSend = jest.fn();
  let configValues: Record<string, string | undefined>;
  let configService: ConfigService;
  let service: EmailService;

  beforeEach(() => {
    configValues = {};
    configService = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;

    (Resend as unknown as jest.Mock).mockClear();
    (Resend as unknown as jest.Mock).mockImplementation(() => ({
      emails: {
        send: mockResendSend,
      },
    }));

    mockResendSend.mockReset();
    service = new EmailService(configService);
  });

  it('skips when recipients are missing', async () => {
    const result = await service.send({
      to: [],
      subject: 'Hello',
      text: 'Body',
    });

    expect(result).toEqual({
      status: 'skipped',
      providerMessageId: null,
      errorMessage: 'No recipients configured',
    });
  });

  it('sends through Resend when configured', async () => {
    configValues.RESEND_API_KEY = 're_test';
    configValues.RESEND_FROM = 'GrillRent <hello@example.com>';
    mockResendSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });

    const result = await service.send({
      to: ['admin@example.com'],
      from: 'GrillRent <support@example.com>',
      subject: 'Subject',
      text: 'Plain text',
      html: '<p>HTML</p>',
      replyTo: 'reply@example.com',
      inReplyTo: '<original@message.id>',
      references: '<root@message.id> <original@message.id>',
      headers: { 'X-Test': 'ok' },
      attachments: [
        {
          filename: 'test.txt',
          content: 'YWJj',
          contentType: 'text/plain',
          encoding: 'base64',
        },
      ],
    });

    expect(result).toEqual({
      status: 'sent',
      providerMessageId: 'email_123',
      errorMessage: null,
    });
    expect(Resend).toHaveBeenCalledWith('re_test');
    expect(mockResendSend).toHaveBeenCalledWith({
      from: 'GrillRent <support@example.com>',
      to: ['admin@example.com'],
      subject: 'Subject',
      text: 'Plain text',
      html: '<p>HTML</p>',
      replyTo: 'reply@example.com',
      headers: {
        'X-Test': 'ok',
        'In-Reply-To': '<original@message.id>',
        References: '<root@message.id> <original@message.id>',
      },
      attachments: [
        {
          filename: 'test.txt',
          content: Buffer.from('abc'),
          contentType: 'text/plain',
        },
      ],
    });
  });

  it('reuses resend client for repeated sends with same key', async () => {
    configValues.RESEND_API_KEY = 're_test';
    configValues.RESEND_FROM = 'GrillRent <hello@example.com>';
    mockResendSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });

    await service.send({
      to: ['admin@example.com'],
      subject: 'A',
      text: 'A',
    });
    await service.send({
      to: ['admin@example.com'],
      subject: 'B',
      text: 'B',
    });

    expect(Resend).toHaveBeenCalledTimes(1);
  });

  it('skips resend when api key is missing', async () => {
    configValues.RESEND_FROM = 'GrillRent <hello@example.com>';

    const result = await service.send({
      to: ['admin@example.com'],
      subject: 'Subject',
      text: 'Body',
    });

    expect(result).toEqual({
      status: 'skipped',
      providerMessageId: null,
      errorMessage: 'RESEND_API_KEY must be configured',
    });
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});
