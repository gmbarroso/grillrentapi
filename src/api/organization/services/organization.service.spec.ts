import { ConflictException } from '@nestjs/common';
import { OrganizationService } from './organization.service';

describe('OrganizationService', () => {
  const organizationRepository = {
    findOne: jest.fn(),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: 'org-1', ...payload })),
  };

  let service: OrganizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganizationService(organizationRepository as any);
  });

  it('creates with generated slug and suffixes collisions', async () => {
    organizationRepository.findOne.mockImplementation(async ({ where }) => {
      if (where?.slug === 'chacara-sacopa') return { id: 'org-existing' };
      return null;
    });

    const result = await service.create({
      name: 'Chácara Sacopã',
    });

    expect(result.organization.slug).toBe('chacara-sacopa-2');
  });

  it('throws conflict for duplicated custom slug', async () => {
    organizationRepository.findOne.mockImplementation(async ({ where }) => {
      if (where?.slug === 'custom-org') return { id: 'org-existing' };
      return null;
    });

    await expect(
      service.create({
        name: 'Organization',
        slug: 'custom-org',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('keeps unique custom slug as provided after normalization', async () => {
    organizationRepository.findOne.mockResolvedValue(null);

    const result = await service.create({
      name: 'Condominio Central',
      slug: 'condominio-central',
    });

    expect(result.organization.slug).toBe('condominio-central');
  });
});
