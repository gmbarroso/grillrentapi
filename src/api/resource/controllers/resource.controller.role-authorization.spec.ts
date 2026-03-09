import { ForbiddenException } from '@nestjs/common';
import { ResourceController } from './resource.controller';
import { UserRole } from '../../user/entities/user.entity';

describe('Phase 5 - API role authorization regression', () => {
  const resourceService = {
    create: jest.fn(async (dto) => ({ id: 'resource-1', ...dto })),
    update: jest.fn(async (id, dto) => ({ id, ...dto })),
    remove: jest.fn(async (id) => ({ message: `removed:${id}` })),
    findAll: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
  };

  const adminUser = {
    id: 'admin-1',
    name: 'Admin',
    email: 'admin@example.com',
    password: 'x',
    apartment: '1',
    block: 1,
    role: UserRole.ADMIN,
  };

  const residentUser = {
    id: 'resident-1',
    name: 'Resident',
    email: 'resident@example.com',
    password: 'x',
    apartment: '2',
    block: 1,
    role: UserRole.RESIDENT,
  };

  let controller: ResourceController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ResourceController(resourceService as any);
  });

  it('allows admin and denies resident on protected write operations', async () => {
    await expect(
      controller.create(adminUser as any, { name: 'Grill', type: 'hourly' }),
    ).resolves.toEqual({ id: 'resource-1', name: 'Grill', type: 'hourly' });
    await expect(
      controller.update(adminUser as any, 'resource-1', { name: 'Updated Grill' }),
    ).resolves.toEqual({ id: 'resource-1', name: 'Updated Grill' });
    await expect(
      controller.remove(adminUser as any, 'resource-1'),
    ).resolves.toEqual({ message: 'removed:resource-1' });

    await expect(
      controller.create(residentUser as any, { name: 'Grill', type: 'hourly' }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.update(residentUser as any, 'resource-1', { name: 'Updated Grill' }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.remove(residentUser as any, 'resource-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
