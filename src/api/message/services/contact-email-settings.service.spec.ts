import { Repository } from 'typeorm';
import { ContactEmailSettingsService } from './contact-email-settings.service';
import { OrganizationContactEmailSettings } from '../entities/organization-contact-email-settings.entity';

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

    service = new ContactEmailSettingsService(repository);
  });

  it('returns in_app_only defaults when organization has no settings', async () => {
    await expect(service.getSettings('org-1')).resolves.toEqual({
      deliveryMode: 'in_app_only',
      recipientEmails: [],
      fromName: null,
      fromEmail: null,
      replyToMode: 'resident_email',
      customReplyTo: null,
      canSendEmail: false,
      validationErrors: [],
    });
  });

  it('keeps settings isolated by organization', async () => {
    await service.updateSettings('org-1', {
      deliveryMode: 'in_app_and_email',
      recipientEmails: ['Admin@Condo.com'],
      fromName: 'Condo Team',
      fromEmail: 'No-Reply@Condo.com',
      replyToMode: 'resident_email',
    });

    const org1 = await service.getSettings('org-1');
    const org2 = await service.getSettings('org-2');

    expect(org1.deliveryMode).toBe('in_app_and_email');
    expect(org1.recipientEmails).toEqual(['admin@condo.com']);
    expect(org1.fromEmail).toBe('no-reply@condo.com');
    expect(org1.canSendEmail).toBe(true);

    expect(org2.deliveryMode).toBe('in_app_only');
    expect(org2.recipientEmails).toEqual([]);
    expect(org2.canSendEmail).toBe(false);
  });

  it('marks config invalid when custom reply-to is missing', async () => {
    await service.updateSettings('org-1', {
      deliveryMode: 'in_app_and_email',
      recipientEmails: ['admin@condo.com'],
      fromEmail: 'faleconosco@seuze.tech',
      replyToMode: 'custom',
      customReplyTo: '',
    });

    const result = await service.resolveDeliveryConfig('org-1', 'resident@unit.com');

    expect(result.shouldSend).toBe(false);
    if (!result.shouldSend) {
      expect(result.validationErrors).toContain('customReplyTo is required when replyToMode is custom');
    }
  });

  it('builds organization sender header when fromEmail is valid', async () => {
    await service.updateSettings('org-1', {
      deliveryMode: 'in_app_and_email',
      recipientEmails: ['admin@condo.com'],
      fromName: 'Chacara Seu Ze',
      fromEmail: 'faleconosco.chacara@seuze.tech',
      replyToMode: 'resident_email',
    });

    await expect(service.resolveOrganizationSenderFrom('org-1')).resolves.toBe(
      'Chacara Seu Ze <faleconosco.chacara@seuze.tech>',
    );
  });
});
