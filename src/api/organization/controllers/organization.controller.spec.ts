import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from '../services/organization.service';
import { InternalServiceAuthGuard } from '../../../shared/auth/guards/internal-service-auth.guard';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let service: jest.Mocked<OrganizationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [
        {
          provide: OrganizationService,
          useValue: {
            create: jest.fn(),
            findBySlug: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(InternalServiceAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrganizationController>(OrganizationController);
    service = module.get(OrganizationService) as jest.Mocked<OrganizationService>;
  });

  it('creates organization when authenticated user is admin', async () => {
    const dto = { name: 'Condominio Norte' };
    const payload = { message: 'ok', organization: { id: 'org-1' } };
    service.create.mockResolvedValue(payload as any);

    await expect(controller.create(dto as any, { user: { role: UserRole.ADMIN } } as any)).resolves.toEqual(payload);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('rejects organization creation for non-admin users', async () => {
    await expect(
      controller.create({ name: 'Condominio Norte' } as any, { user: { role: UserRole.RESIDENT } } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('looks up organization by slug', async () => {
    const payload = { id: 'org-1', slug: 'chacara-sacopa', name: 'Chacara Sacopa' };
    service.findBySlug.mockResolvedValue(payload as any);

    await expect(controller.findBySlug('chacara-sacopa')).resolves.toEqual(payload);
    expect(service.findBySlug).toHaveBeenCalledWith('chacara-sacopa');
  });
});
