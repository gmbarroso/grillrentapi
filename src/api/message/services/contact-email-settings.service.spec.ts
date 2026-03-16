import { Repository } from 'typeorm';
import { ContactEmailSettingsService } from './contact-email-settings.service';
import { OrganizationContactEmailSettings } from '../entities/organization-contact-email-settings.entity';
import { ConfigService } from '@nestjs/config';

describe('ContactEmailSettingsService', () => {
  let service: ContactEmailSettingsService;
  let repository: jest.Mocked<Repository<OrganizationContactEmailSettings>>;
  let store: Record<string, OrganizationContactEmailSettings>;

  beforeEach(() => {
    store = {};
    repository = {
      findOne: jest.fn(async ({ where }: any) => store[where.organizationId] ?? null),
      create: jest.fn((payload: any) => payload),
      save: jest.fn(async (entity: OrganizationContactEmailSettings) => {
        const organizationId = entity.organizationId;
        const nextEntity = {
          ...entity,
          id: entity.id || `settings-${organizationId}`,
        } as OrganizationContactEmailSettings;
        store[organizationId] = nextEntity;
        return nextEntity;
      }),
    } as unknown as jest.Mocked<Repository<OrganizationContactEmailSettings>>;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'ORG_SMTP_ENCRYPTION_KEY') {
          return '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
        }
        if (key === 'ORG_SMTP_ENCRYPTION_KEY_VERSION') {
          return 'v1';
        }
        if (key === 'NODE_ENV') {
          return 'test';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new ContactEmailSettingsService(repository, configService);
  });

  it('returns in_app_only defaults when organization has no settings', async () => {
    await expect(service.getSettings('org-1')).resolves.toEqual({
      deliveryMode: 'in_app_only',
      recipientEmails: [],
      fromName: null,
      fromEmail: null,
      replyToMode: 'resident_email',
      customReplyTo: null,
      smtpHost: null,
      smtpPort: null,
      smtpSecure: null,
      smtpUser: null,
      smtpFrom: null,
      hasSmtpPassword: false,
      canSendEmail: false,
      validationErrors: [],
    });
  });

  it('keeps settings isolated by organization', async () => {
    await service.updateSettings('org-1', {
      deliveryMode: 'in_app_and_email',
      recipientEmails: ['Admin@Condo.com'],
      smtpHost: 'smtp.condo.com',
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: 'mailer@condo.com',
      smtpFrom: 'noreply@condo.com',
      smtpAppPassword: 'app-password',
      replyToMode: 'resident_email',
    });

    const org1 = await service.getSettings('org-1');
    const org2 = await service.getSettings('org-2');

    expect(org1.deliveryMode).toBe('in_app_and_email');
    expect(org1.recipientEmails).toEqual(['admin@condo.com']);
    expect(org1.hasSmtpPassword).toBe(true);
    expect(org1.canSendEmail).toBe(true);

    expect(org2.deliveryMode).toBe('in_app_only');
    expect(org2.recipientEmails).toEqual([]);
    expect(org2.hasSmtpPassword).toBe(false);
    expect(org2.canSendEmail).toBe(false);
  });

  it('marks config invalid when custom reply-to is missing', async () => {
    await service.updateSettings('org-1', {
      deliveryMode: 'in_app_and_email',
      recipientEmails: ['admin@condo.com'],
      smtpHost: 'smtp.condo.com',
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: 'mailer@condo.com',
      smtpFrom: 'noreply@condo.com',
      smtpAppPassword: 'app-password',
      replyToMode: 'custom',
      customReplyTo: '',
    });

    const result = await service.resolveDeliveryConfig('org-1', 'resident@unit.com');

    expect(result.shouldSend).toBe(false);
    if (!result.shouldSend) {
      expect(result.validationErrors).toContain('customReplyTo is required when replyToMode is custom');
    }
  });
});
