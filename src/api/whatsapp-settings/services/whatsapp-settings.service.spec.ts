import { WhatsappSettingsService } from './whatsapp-settings.service';

describe('WhatsappSettingsService onboarding', () => {
  const organizationRepository = {
    findOne: jest.fn(),
  };
  const integrationRepository = {
    findOne: jest.fn(),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: payload.id || 'integration-1', ...payload })),
    update: jest.fn(),
  };
  const bindingRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => payload),
    delete: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'WHATSAPP_EVOLUTION_BASE_URL') return 'https://evolution.example.com';
      if (key === 'WHATSAPP_EVOLUTION_API_KEY') return 'provider-api-key';
      if (key === 'WHATSAPP_INSTANCE_PREFIX') return 'grillrent';
      return undefined;
    }),
  };

  let service: WhatsappSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WhatsappSettingsService(
      organizationRepository as any,
      integrationRepository as any,
      bindingRepository as any,
      configService as any,
    );
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('starts onboarding with auto-generated instance name and qr payload', async () => {
    organizationRepository.findOne.mockResolvedValue({ id: 'org-1', slug: 'Condominio Central' });
    integrationRepository.findOne.mockResolvedValueOnce(null);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '[]',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ instance: { state: 'close' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ base64: 'BASE64_QR', expiresIn: 42 }),
      });
    (global as any).fetch = fetchMock;

    const result = await service.startOnboarding('org-1');

    expect(result.state).toBe('qr_ready');
    expect(result.instanceName).toBe('grillrent-condominio-central');
    expect(result.qrCodeBase64).toBe('BASE64_QR');
    expect(result.ttlSeconds).toBe(42);
    expect(result.statusEndpoint).toBe('/whatsapp/settings/onboarding/status');
  });

  it('returns active onboarding state when connection is open and notices binding exists', async () => {
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      organizationId: 'org-1',
      provider: 'evolution',
      baseUrl: 'https://evolution.example.com',
      instanceName: 'grillrent-condominio-central',
      apiKey: 'provider-api-key',
      status: 'disconnected',
      autoSendNotices: true,
      whatsappNumber: '5511999990000',
    });
    bindingRepository.findOne.mockResolvedValue({ groupJid: '120363000000000000@g.us' });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ instance: { state: 'open' } }),
    });

    const result = await service.getOnboardingStatus('org-1');

    expect(result.state).toBe('active');
    expect(result.status).toBe('connected');
    expect(result.qrCodeBase64).toBeNull();
    expect(result.maskedWhatsappNumber).toBe('••••0000');
  });

  it('falls back to /instance/qr/... when /instance/connect/... returns 404', async () => {
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      organizationId: 'org-1',
      provider: 'evolution',
      baseUrl: 'https://evolution.example.com',
      instanceName: 'grillrent-test',
      apiKey: 'provider-api-key',
      status: 'disconnected',
      autoSendNotices: true,
      whatsappNumber: null,
    });

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ instance: { state: 'close' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ base64: 'QR_FALLBACK', expiresIn: 30 }),
      });
    (global as any).fetch = fetchMock;

    const result = await service.getOnboardingStatus('org-1');

    expect(result.state).toBe('qr_ready');
    expect(result.qrCodeBase64).toBe('QR_FALLBACK');
    expect(result.ttlSeconds).toBe(30);
  });

  it('throws BadGatewayException when provider instance creation returns non-2xx', async () => {
    organizationRepository.findOne.mockResolvedValue({ id: 'org-1', slug: 'Test Org' });
    integrationRepository.findOne.mockResolvedValueOnce(null);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '[]',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });
    (global as any).fetch = fetchMock;

    await expect(service.startOnboarding('org-1')).rejects.toThrow('Unable to create WhatsApp provider instance');
  });

  it('throws BadGatewayException when QR fetch returns non-2xx error', async () => {
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      organizationId: 'org-1',
      provider: 'evolution',
      baseUrl: 'https://evolution.example.com',
      instanceName: 'grillrent-test',
      apiKey: 'provider-api-key',
      status: 'disconnected',
      autoSendNotices: true,
      whatsappNumber: null,
    });

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ instance: { state: 'close' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
    (global as any).fetch = fetchMock;

    await expect(service.getOnboardingStatus('org-1')).rejects.toThrow(
      'Unable to fetch WhatsApp QR code from provider',
    );
  });

  it('disconnects onboarding and clears persisted bindings', async () => {
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      organizationId: 'org-1',
      provider: 'evolution',
      baseUrl: 'https://evolution.example.com',
      instanceName: 'grillrent-condominio-central',
      apiKey: 'provider-api-key',
      status: 'connected',
      autoSendNotices: true,
    });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({}),
    });

    const result = await service.disconnectOnboarding('org-1');

    expect(result).toEqual({ ok: true });
    expect(bindingRepository.delete).toHaveBeenCalledWith({ organizationId: 'org-1' });
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        status: 'disconnected',
        autoSendNotices: false,
      }),
    );
  });
});
