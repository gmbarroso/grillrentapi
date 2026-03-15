import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';
import { ContactEmailSettingsController } from './contact-email-settings.controller';
import { ContactEmailSettingsService } from '../services/contact-email-settings.service';

describe('ContactEmailSettingsController', () => {
  let controller: ContactEmailSettingsController;
  let service: jest.Mocked<ContactEmailSettingsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactEmailSettingsController],
      providers: [
        {
          provide: ContactEmailSettingsService,
          useValue: {
            getSettings: jest.fn(),
            updateSettings: jest.fn(),
            resolveDeliveryConfig: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ContactEmailSettingsController>(ContactEmailSettingsController);
    service = module.get(ContactEmailSettingsService) as jest.Mocked<ContactEmailSettingsService>;
  });

  it('allows admin to read settings', async () => {
    service.getSettings.mockResolvedValue({ deliveryMode: 'in_app_only' } as any);

    await expect(
      controller.getSettings({
        user: { role: UserRole.ADMIN, organizationId: 'org-1' },
      } as any),
    ).resolves.toEqual({ deliveryMode: 'in_app_only' });

    expect(service.getSettings).toHaveBeenCalledWith('org-1');
  });

  it('blocks non-admin from reading settings', async () => {
    await expect(
      controller.getSettings({
        user: { role: UserRole.RESIDENT, organizationId: 'org-1' },
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows admin to update settings', async () => {
    service.updateSettings.mockResolvedValue({ deliveryMode: 'in_app_and_email' } as any);

    await expect(
      controller.updateSettings(
        { user: { role: UserRole.ADMIN, organizationId: 'org-1' } } as any,
        {
          deliveryMode: 'in_app_and_email',
          recipientEmails: ['admin@condo.com'],
          replyToMode: 'resident_email',
        } as any,
      ),
    ).resolves.toEqual({ deliveryMode: 'in_app_and_email' });

    expect(service.updateSettings).toHaveBeenCalledWith('org-1', {
      deliveryMode: 'in_app_and_email',
      recipientEmails: ['admin@condo.com'],
      replyToMode: 'resident_email',
    });
  });
});
