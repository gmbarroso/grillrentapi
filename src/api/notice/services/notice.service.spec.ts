import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NoticeService } from './notice.service';
import { Notice } from '../entities/notice.entity';
import { NoticeReadState } from '../entities/notice-read-state.entity';
import { WhatsappSettingsService } from '../../whatsapp-settings/services/whatsapp-settings.service';

describe('NoticeService', () => {
  let service: NoticeService;
  let noticeRepository: jest.Mocked<Repository<Notice>>;
  let noticeReadStateRepository: jest.Mocked<Repository<NoticeReadState>>;
  let configService: jest.Mocked<ConfigService>;
  let whatsappSettingsService: jest.Mocked<WhatsappSettingsService>;

  const defaultEnv: Record<string, string> = {
    WHATSAPP_EVOLUTION_BASE_URL: 'https://evolution.example.com',
    WHATSAPP_EVOLUTION_INSTANCE: 'instance-a',
    WHATSAPP_EVOLUTION_API_KEY: 'secret',
    WHATSAPP_GROUP_JID_BY_ORG: JSON.stringify({ 'org-1': '120363000000000000@g.us' }),
    WHATSAPP_SEND_MAX_ATTEMPTS: '2',
    WHATSAPP_SEND_BASE_BACKOFF_MS: '1',
    WHATSAPP_SEND_TIMEOUT_MS: '1000',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticeService,
        { provide: getRepositoryToken(Notice), useClass: Repository },
        { provide: getRepositoryToken(NoticeReadState), useClass: Repository },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => defaultEnv[key]),
          },
        },
        {
          provide: WhatsappSettingsService,
          useValue: {
            isAutoSendNoticesEnabled: jest.fn().mockResolvedValue(false),
            getDeliveryConfigForFeature: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<NoticeService>(NoticeService);
    noticeRepository = module.get(getRepositoryToken(Notice));
    noticeReadStateRepository = module.get(getRepositoryToken(NoticeReadState));
    configService = module.get(ConfigService);
    whatsappSettingsService = module.get(WhatsappSettingsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns hasUnread=true when read state does not exist and notices exist', async () => {
    const querySpy = jest.spyOn(noticeReadStateRepository, 'query').mockResolvedValue([
      { hasUnread: true, lastSeenNoticesAt: null },
    ]);

    await expect(service.getUnreadCount('user-1', 'org-1')).resolves.toEqual({
      hasUnread: true,
      lastSeenNoticesAt: null,
    });

    expect(querySpy).toHaveBeenCalledWith(expect.stringContaining('WITH "read_state"'), ['user-1', 'org-1']);
  });

  it('returns hasUnread=true when there are notices newer than lastSeenNoticesAt', async () => {
    const querySpy = jest.spyOn(noticeReadStateRepository, 'query').mockResolvedValue([
      {
        hasUnread: 'true',
        lastSeenNoticesAt: '2026-03-01T10:00:00.000Z',
      },
    ]);

    const result = await service.getUnreadCount('user-1', 'org-1');

    expect(result.hasUnread).toBe(true);
    expect(result.lastSeenNoticesAt).toBe('2026-03-01T10:00:00.000Z');
    expect(querySpy).toHaveBeenCalledWith(expect.any(String), ['user-1', 'org-1']);
  });

  it('returns hasUnread=false when there are no notices newer than lastSeenNoticesAt', async () => {
    jest.spyOn(noticeReadStateRepository, 'query').mockResolvedValue([
      {
        hasUnread: false,
        lastSeenNoticesAt: '2026-03-15T05:00:00.000Z',
      },
    ]);

    const result = await service.getUnreadCount('user-1', 'org-1');

    expect(result.hasUnread).toBe(false);
    expect(result.lastSeenNoticesAt).toBe('2026-03-15T05:00:00.000Z');
  });

  it('preserves microsecond read-state boundary by relying on SQL comparison', async () => {
    jest.spyOn(noticeReadStateRepository, 'query').mockResolvedValue([
      {
        hasUnread: false,
        lastSeenNoticesAt: '2026-03-15T05:00:00.123457Z',
      },
    ]);

    const result = await service.getUnreadCount('user-1', 'org-1');

    expect(result.hasUnread).toBe(false);
    expect(result.lastSeenNoticesAt).toBe('2026-03-15T05:00:00.123Z');
  });

  it('creates read state when marking seen for first time', async () => {
    jest.spyOn(noticeReadStateRepository, 'findOne').mockResolvedValue(null);
    jest.spyOn(noticeReadStateRepository, 'query').mockResolvedValue([
      { lastSeenNoticesAt: '2026-03-09T10:00:00.123Z' },
    ]);

    const result = await service.markAllAsSeen('user-1', 'org-1');

    expect(noticeReadStateRepository.query).toHaveBeenCalled();
    expect(result.previousLastSeenNoticesAt).toBeNull();
    expect(result.markedAsSeenAt).toBe('2026-03-09T10:00:00.123Z');
  });

  it('updates read state inside organization scope', async () => {
    const existing = {
      id: 'state-1',
      userId: 'user-1',
      organizationId: 'org-1',
      lastSeenNoticesAt: new Date('2026-03-02T10:00:00.000Z'),
      createdAt: new Date('2026-03-02T10:00:00.000Z'),
      updatedAt: new Date('2026-03-02T10:00:00.000Z'),
    } as NoticeReadState;

    jest.spyOn(noticeReadStateRepository, 'findOne').mockResolvedValue(existing);
    jest.spyOn(noticeReadStateRepository, 'query').mockResolvedValue([
      { lastSeenNoticesAt: '2026-03-09T11:00:00.789Z' },
    ]);

    const result = await service.markAllAsSeen('user-1', 'org-1');

    expect(noticeReadStateRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', organizationId: 'org-1' },
    });
    expect(result.previousLastSeenNoticesAt).toBe('2026-03-02T10:00:00.000Z');
    expect(result.markedAsSeenAt).toBe('2026-03-09T11:00:00.789Z');
  });

  it('sends whatsapp once and marks notice as sent', async () => {
    const createdNotice = {
      id: 'notice-1',
      title: 'Titulo',
      subtitle: 'Subtitulo',
      content: 'Mensagem',
      sendViaWhatsapp: true,
      organizationId: 'org-1',
      whatsappDeliveryStatus: 'pending',
      whatsappAttemptCount: 0,
    } as Notice;

    jest.spyOn(noticeRepository, 'create').mockReturnValue(createdNotice);

    const saveSpy = jest
      .spyOn(noticeRepository, 'save')
      .mockResolvedValueOnce(createdNotice)
      .mockImplementation(async (value: Notice) => value as Notice);

    jest.spyOn(noticeRepository, 'findOne').mockResolvedValue(createdNotice);

    (global.fetch as jest.Mock | undefined) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ key: { id: 'provider-123' } }),
    });

    const result = await service.create(
      {
        title: 'Titulo',
        subtitle: 'Subtitulo',
        content: 'Mensagem',
        sendViaWhatsapp: true,
      },
      'org-1',
    );

    expect(saveSpy).toHaveBeenCalled();
    expect(result.whatsappDeliveryStatus).toBe('sent');
    expect(result.whatsappProviderMessageId).toBe('provider-123');
    expect(result.whatsappAttemptCount).toBe(1);
  });

  it('does not send duplicate provider message when already sent', async () => {
    const alreadySent = {
      id: 'notice-2',
      title: 'Titulo',
      content: 'Mensagem',
      sendViaWhatsapp: true,
      organizationId: 'org-1',
      whatsappDeliveryStatus: 'sent',
      whatsappProviderMessageId: 'provider-abc',
      whatsappAttemptCount: 1,
    } as Notice;

    jest.spyOn(noticeRepository, 'create').mockReturnValue(alreadySent);
    jest.spyOn(noticeRepository, 'save').mockResolvedValue(alreadySent);
    jest.spyOn(noticeRepository, 'findOne').mockResolvedValue(alreadySent);

    (global.fetch as jest.Mock | undefined) = jest.fn();

    const result = await service.create(
      {
        title: 'Titulo',
        content: 'Mensagem',
        sendViaWhatsapp: true,
      },
      'org-1',
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.whatsappDeliveryStatus).toBe('sent');
  });

  it('marks notice as failed when provider fails after retries', async () => {
    const createdNotice = {
      id: 'notice-3',
      title: 'Titulo',
      content: 'Mensagem',
      sendViaWhatsapp: true,
      organizationId: 'org-1',
      whatsappDeliveryStatus: 'pending',
      whatsappAttemptCount: 0,
    } as Notice;

    jest.spyOn(noticeRepository, 'create').mockReturnValue(createdNotice);
    jest
      .spyOn(noticeRepository, 'save')
      .mockResolvedValueOnce(createdNotice)
      .mockImplementation(async (value: Notice) => value as Notice);
    jest.spyOn(noticeRepository, 'findOne').mockResolvedValue(createdNotice);

    (global.fetch as jest.Mock | undefined) = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ message: 'temporary error' }),
    });

    const result = await service.create(
      {
        title: 'Titulo',
        content: 'Mensagem',
        sendViaWhatsapp: true,
      },
      'org-1',
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.whatsappDeliveryStatus).toBe('failed');
    expect(result.whatsappAttemptCount).toBe(2);
    expect(result.whatsappLastError).toContain('Provider rejected notice message');
  });

  it('marks as skipped when organization whatsapp group is not configured', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'WHATSAPP_GROUP_JID_BY_ORG') {
        return JSON.stringify({});
      }
      return defaultEnv[key];
    });

    const createdNotice = {
      id: 'notice-4',
      title: 'Titulo',
      content: 'Mensagem',
      sendViaWhatsapp: true,
      organizationId: 'org-1',
      whatsappDeliveryStatus: 'pending',
      whatsappAttemptCount: 0,
    } as Notice;

    jest.spyOn(noticeRepository, 'create').mockReturnValue(createdNotice);
    jest
      .spyOn(noticeRepository, 'save')
      .mockResolvedValueOnce(createdNotice)
      .mockImplementation(async (value: Notice) => value as Notice);
    jest.spyOn(noticeRepository, 'findOne').mockResolvedValue(createdNotice);

    (global.fetch as jest.Mock | undefined) = jest.fn();

    const result = await service.create(
      {
        title: 'Titulo',
        content: 'Mensagem',
        sendViaWhatsapp: true,
      },
      'org-1',
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.whatsappDeliveryStatus).toBe('skipped');
    expect(result.whatsappLastError).toContain('not configured');
  });

  it('auto-sends notice when organization autoSendNotices is enabled even if DTO flag is false', async () => {
    whatsappSettingsService.isAutoSendNoticesEnabled.mockResolvedValue(true);
    whatsappSettingsService.getDeliveryConfigForFeature.mockResolvedValue({
      baseUrl: 'https://db-config.example.com',
      instanceName: 'db-instance',
      apiKey: 'db-key',
      groupJid: '120363111111111111@g.us',
      autoSendNotices: true,
    });

    const createdNotice = {
      id: 'notice-5',
      title: 'Titulo',
      content: 'Mensagem',
      sendViaWhatsapp: true,
      organizationId: 'org-1',
      whatsappDeliveryStatus: 'pending',
      whatsappAttemptCount: 0,
    } as Notice;

    jest.spyOn(noticeRepository, 'create').mockReturnValue(createdNotice);
    jest
      .spyOn(noticeRepository, 'save')
      .mockResolvedValueOnce(createdNotice)
      .mockImplementation(async (value: Notice) => value as Notice);
    jest.spyOn(noticeRepository, 'findOne').mockResolvedValue(createdNotice);

    (global.fetch as jest.Mock | undefined) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ key: { id: 'provider-auto' } }),
    });

    const result = await service.create(
      {
        title: 'Titulo',
        content: 'Mensagem',
        sendViaWhatsapp: false,
      },
      'org-1',
    );

    expect(result.whatsappDeliveryStatus).toBe('sent');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('prefers DB delivery configuration over legacy env fallback when both are available', async () => {
    whatsappSettingsService.getDeliveryConfigForFeature.mockResolvedValue({
      baseUrl: 'https://db-config.example.com',
      instanceName: 'db-instance',
      apiKey: 'db-key',
      groupJid: '120363222222222222@g.us',
      autoSendNotices: false,
    });

    const createdNotice = {
      id: 'notice-6',
      title: 'Titulo',
      content: 'Mensagem',
      sendViaWhatsapp: true,
      organizationId: 'org-1',
      whatsappDeliveryStatus: 'pending',
      whatsappAttemptCount: 0,
    } as Notice;

    jest.spyOn(noticeRepository, 'create').mockReturnValue(createdNotice);
    jest
      .spyOn(noticeRepository, 'save')
      .mockResolvedValueOnce(createdNotice)
      .mockImplementation(async (value: Notice) => value as Notice);
    jest.spyOn(noticeRepository, 'findOne').mockResolvedValue(createdNotice);

    (global.fetch as jest.Mock | undefined) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ key: { id: 'provider-db-priority' } }),
    });

    await service.create(
      {
        title: 'Titulo',
        content: 'Mensagem',
        sendViaWhatsapp: true,
      },
      'org-1',
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://db-config.example.com/message/sendText/db-instance'),
      expect.objectContaining({
        body: expect.stringContaining('120363222222222222@g.us'),
      }),
    );
  });
});
