import { UnauthorizedException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

describe('WhatsappWebhookService', () => {
  const noticeRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const groupBindingRepository = {
    createQueryBuilder: jest.fn(),
  };

  const integrationRepository = {
    findOne: jest.fn(),
  };

  const inboundEventRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  let service: WhatsappWebhookService;

  const validPayload = {
    event: 'messages.upsert',
    data: {
      key: {
        id: 'provider-msg-1',
        remoteJid: '120363405906248196@g.us',
        participant: '5521999999999@s.whatsapp.net',
      },
      pushName: 'Condo Admin',
      messageTimestamp: 1763660000,
      message: {
        conversation: 'Aviso importante para todos',
      },
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();

    service = new WhatsappWebhookService(
      noticeRepository as any,
      groupBindingRepository as any,
      integrationRepository as any,
      inboundEventRepository as any,
      configService as any,
    );

    configService.get.mockReturnValue('webhook-secret-123');
    noticeRepository.create.mockImplementation((value) => value);
    inboundEventRepository.create.mockImplementation((value) => value);
  });

  it('rejects webhook when secret is invalid', async () => {
    await expect(service.handleEvolutionWebhook(validPayload, 'invalid-secret')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('ignores valid message when group is not bound', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    groupBindingRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.handleEvolutionWebhook(validPayload, 'webhook-secret-123');
    expect(result.status).toBe('ignored_group_not_bound');
  });

  it('returns duplicate for idempotent re-delivery', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        integrationId: 'integration-1',
        groupJid: '120363405906248196@g.us',
      }),
    };
    groupBindingRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const duplicateError = new QueryFailedError(
      'INSERT INTO notice_whatsapp_inbound_event',
      [],
      { code: '23505' } as any,
    );
    inboundEventRepository.save.mockRejectedValue(duplicateError);

    const result = await service.handleEvolutionWebhook(validPayload, 'webhook-secret-123');
    expect(result.status).toBe('duplicate');
  });

  it('creates notice for group-admin sender', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        integrationId: 'integration-1',
        groupJid: '120363405906248196@g.us',
      }),
    };
    groupBindingRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    inboundEventRepository.save
      .mockResolvedValueOnce({ id: 'inbound-1', organizationId: 'org-1' })
      .mockResolvedValueOnce({ id: 'inbound-1', organizationId: 'org-1', processedAsNotice: true, noticeId: 'notice-1' });

    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      baseUrl: 'https://evolution-api.example.com',
      instanceName: 'grillrent-test',
      apiKey: 'abc',
      whatsappNumber: '+55 21 99999-9999',
    });

    noticeRepository.save.mockResolvedValue({ id: 'notice-1' });

    const result = await service.handleEvolutionWebhook(validPayload, 'webhook-secret-123');

    expect(result.status).toBe('created');
    expect(result.noticeId).toBe('notice-1');
    expect(noticeRepository.save).toHaveBeenCalledTimes(1);
  });
});
