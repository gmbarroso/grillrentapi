import { Test, TestingModule } from '@nestjs/testing';
import { ResourceController } from './resource.controller';
import { ResourceService } from '../services/resource.service';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { UpdateResourceDto } from '../dto/update-resource.dto';
import { Resource } from '../entities/resource.entity';

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
        description: 'Test Description',
      };
      const resource: Resource = { id: '1', ...createResourceDto, bookings: [] };
      const result = { message: 'Resource created successfully', resource };

      jest.spyOn(service, 'create').mockResolvedValue(result);

      expect(await controller.create(createResourceDto)).toBe(result);
    });
  });

  describe('findAll', () => {
    it('should find all resources', async () => {
      const resources: Resource[] = [
        { id: '1', name: 'Test Resource 1', type: 'Test Type 1', description: 'Test Description 1', bookings: [] },
        { id: '2', name: 'Test Resource 2', type: 'Test Type 2', description: 'Test Description 2', bookings: [] },
      ];

      jest.spyOn(service, 'findAll').mockResolvedValue(resources);

      expect(await controller.findAll()).toBe(resources);
    });
  });

  describe('findOne', () => {
    it('should find one resource', async () => {
      const resource: Resource = { id: '1', name: 'Test Resource', type: 'Test Type', description: 'Test Description', bookings: [] };

      jest.spyOn(service, 'findOne').mockResolvedValue(resource);

      expect(await controller.findOne('1')).toBe(resource);
    });
  });

  describe('update', () => {
    it('should update a resource', async () => {
      const updateResourceDto: UpdateResourceDto = {
        name: 'Updated Resource',
        type: 'Updated Type',
        description: 'Updated Description',
      };
      const resource: Resource = { id: '1', name: updateResourceDto.name || '', type: updateResourceDto.type || '', description: updateResourceDto.description || '', bookings: [] };
      const result = { message: 'Resource updated successfully', resource };

      jest.spyOn(service, 'update').mockResolvedValue(result);

      expect(await controller.update('1', updateResourceDto)).toBe(result);
    });
  });

  describe('remove', () => {
    it('should remove a resource', async () => {
      const result = { message: 'Resource removed successfully' };

      jest.spyOn(service, 'remove').mockResolvedValue(result);

      expect(await controller.remove('1')).toBe(result);
    });
  });
});
