import { Test, TestingModule } from '@nestjs/testing';
import { ResourceController } from './resource.controller';
import { ResourceService } from '../services/resource.service';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { UpdateResourceDto } from '../dto/update-resource.dto';
import { Resource } from '../entities/resource.entity';
import { User, UserRole } from '../../user/entities/user.entity';
import { ForbiddenException } from '@nestjs/common';

describe('ResourceController', () => {
  let controller: ResourceController;
  let service: jest.Mocked<ResourceService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResourceController],
      providers: [
        {
          provide: ResourceService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ResourceController>(ResourceController);
    service = module.get<ResourceService>(ResourceService) as jest.Mocked<ResourceService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a resource', async () => {
      const createResourceDto: CreateResourceDto = {
        name: 'Test Resource',
        type: 'Test Type',
      };
      const resource: Resource = { id: '1', ...createResourceDto, bookings: [] };
      const result = { message: 'Resource created successfully', resource };
      const user: User = {
        id: '1',
        name: 'adminuser',
        email: 'admin@example.com',
        password: 'hashedpassword',
        apartment: '101',
        block: 1,
        role: UserRole.ADMIN,
      };

      jest.spyOn(service, 'create').mockResolvedValue(result);

      expect(await controller.create(user, createResourceDto)).toEqual(result);
    });

    it('should return an error if user is not admin', async () => {
      const createResourceDto: CreateResourceDto = {
        name: 'Test Resource',
        type: 'Test Type',
      };
      const user: User = {
        id: '1',
        name: 'residentuser',
        email: 'resident@example.com',
        password: 'hashedpassword',
        apartment: '101',
        block: 1,
        role: UserRole.RESIDENT,
      };

      await expect(controller.create(user, createResourceDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should find all resources', async () => {
      const resources: Resource[] = [
        { id: '1', name: 'Test Resource 1', type: 'Test Type 1', bookings: [] },
        { id: '2', name: 'Test Resource 2', type: 'Test Type 2', bookings: [] },
      ];
      const user: User = {
        id: '1',
        name: 'adminuser',
        email: 'admin@example.com',
        password: 'hashedpassword',
        apartment: '101',
        block: 1,
        role: UserRole.ADMIN,
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(resources);

      expect(await controller.findAll(user)).toBe(resources);
    });
  });

  describe('findOne', () => {
    it('should find one resource', async () => {
      const resource: Resource = { id: '1', name: 'Test Resource', type: 'Test Type', bookings: [] };
      const user: User = {
        id: '1',
        name: 'adminuser',
        email: 'admin@example.com',
        password: 'hashedpassword',
        apartment: '101',
        block: 1,
        role: UserRole.ADMIN,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(resource);

      expect(await controller.findOne(user, '1')).toBe(resource);
    });
  });

  describe('update', () => {
    it('should update a resource', async () => {
      const updateResourceDto: UpdateResourceDto = {
        name: 'Updated Resource',
        type: 'Updated Type',
      };
      const resource: Resource = { id: '1', name: updateResourceDto.name || '', type: updateResourceDto.type || '', bookings: [] };
      const user: User = {
        id: '1',
        name: 'adminuser',
        email: 'admin@example.com',
        password: 'hashedpassword',
        apartment: '101',
        block: 1,
        role: UserRole.ADMIN,
      };

      jest.spyOn(service, 'update').mockResolvedValue(resource);

      expect(await controller.update(user, '1', updateResourceDto)).toEqual(resource);
    });
  });

  describe('remove', () => {
    it('should remove a resource', async () => {
      const result = { message: 'Resource removed successfully' };
      const user: User = {
        id: '1',
        name: 'adminuser',
        email: 'admin@example.com',
        password: 'hashedpassword',
        apartment: '101',
        block: 1,
        role: UserRole.ADMIN,
      };

      jest.spyOn(service, 'remove').mockResolvedValue(result);

      expect(await controller.remove(user, '1')).toEqual(result);
    });
  });
});
