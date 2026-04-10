import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { InternalServiceAuthGuard } from '../../../shared/auth/guards/internal-service-auth.guard';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';
import { WhatsappSettingsController } from './whatsapp-settings.controller';
import { WhatsappSettingsService } from '../services/whatsapp-settings.service';

describe('WhatsappSettingsController', () => {
  let controller: WhatsappSettingsController;
  let service: jest.Mocked<WhatsappSettingsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappSettingsController],
      providers: [
        {
          provide: WhatsappSettingsService,
          useValue: {
            getSettings: jest.fn(),
            bootstrapFromLegacyEnv: jest.fn(),
            updateSettings: jest.fn(),
            testConnection: jest.fn(),
            startOnboarding: jest.fn(),
            getOnboardingStatus: jest.fn(),
            refreshOnboardingQr: jest.fn(),
            disconnectOnboarding: jest.fn(),
            fetchGroups: jest.fn(),
            getGroupBindings: jest.fn(),
            upsertGroupBinding: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(InternalServiceAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WhatsappSettingsController>(WhatsappSettingsController);
    service = module.get(WhatsappSettingsService) as jest.Mocked<WhatsappSettingsService>;
  });

  it('proxies onboarding start for admin', async () => {
    service.startOnboarding.mockResolvedValue({ state: 'qr_ready' } as any);

    await expect(controller.startOnboarding({ user: { role: UserRole.ADMIN, organizationId: 'org-1' } } as any)).resolves.toEqual({
      state: 'qr_ready',
    });
    expect(service.startOnboarding).toHaveBeenCalledWith('org-1');
  });

  it('proxies onboarding status for admin', async () => {
    service.getOnboardingStatus.mockResolvedValue({ state: 'connecting' } as any);

    await expect(
      controller.getOnboardingStatus({ user: { role: UserRole.ADMIN, organizationId: 'org-1' } } as any, { forceQr: true }),
    ).resolves.toEqual({ state: 'connecting' });
    expect(service.getOnboardingStatus).toHaveBeenCalledWith('org-1', { forceQr: true });
  });

  it('proxies onboarding refresh qr for admin', async () => {
    service.refreshOnboardingQr.mockResolvedValue({ state: 'qr_ready' } as any);

    await expect(
      controller.refreshOnboardingQr({ user: { role: UserRole.ADMIN, organizationId: 'org-1' } } as any),
    ).resolves.toEqual({ state: 'qr_ready' });
    expect(service.refreshOnboardingQr).toHaveBeenCalledWith('org-1');
  });

  it('proxies onboarding disconnect for admin', async () => {
    service.disconnectOnboarding.mockResolvedValue({ ok: true });

    await expect(
      controller.disconnectOnboarding({ user: { role: UserRole.ADMIN, organizationId: 'org-1' } } as any),
    ).resolves.toEqual({ ok: true });
    expect(service.disconnectOnboarding).toHaveBeenCalledWith('org-1');
  });

  it('blocks onboarding start for non-admin', async () => {
    await expect(
      controller.startOnboarding({ user: { role: UserRole.RESIDENT, organizationId: 'org-1' } } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(service.startOnboarding).not.toHaveBeenCalled();
  });
});
