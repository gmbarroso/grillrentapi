import { UnauthorizedException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

describe('WhatsappWebhookService', () => {
  const fetchMock = jest.fn();
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
    (global as any).fetch = fetchMock;

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

  afterAll(() => {
    delete (global as any).fetch;
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

  it('reuses cached group participants and avoids repeated provider calls', async () => {
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
      .mockResolvedValueOnce({ id: 'inbound-1', organizationId: 'org-1', processedAsNotice: true, noticeId: 'notice-1' })
      .mockResolvedValueOnce({ id: 'inbound-2', organizationId: 'org-1' })
      .mockResolvedValueOnce({ id: 'inbound-2', organizationId: 'org-1', processedAsNotice: true, noticeId: 'notice-2' });

    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      baseUrl: 'https://evolution-api.example.com',
      instanceName: 'grillrent-test',
      apiKey: 'abc',
      whatsappNumber: null,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          {
            id: '120363405906248196@g.us',
            participants: [
              { id: '5521999999999@s.whatsapp.net', admin: true },
              { id: '5521888888888@s.whatsapp.net', admin: false },
            ],
          },
        ]),
    } as any);
    noticeRepository.save
      .mockResolvedValueOnce({ id: 'notice-1' })
      .mockResolvedValueOnce({ id: 'notice-2' });

    const payload2 = {
      ...validPayload,
      data: {
        ...validPayload.data,
        key: {
          ...validPayload.data.key,
          id: 'provider-msg-2',
        },
      },
    };

    await expect(service.handleEvolutionWebhook(validPayload, 'webhook-secret-123')).resolves.toMatchObject({
      status: 'created',
      noticeId: 'notice-1',
    });
    await expect(service.handleEvolutionWebhook(payload2, 'webhook-secret-123')).resolves.toMatchObject({
      status: 'created',
      noticeId: 'notice-2',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
