import { Test, TestingModule } from '@nestjs/testing';
import { ResourceService } from './resource.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Resource } from '../entities/resource.entity';
import { Repository } from 'typeorm';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { UpdateResourceDto } from '../dto/update-resource.dto';

describe('ResourceService', () => {
  let service: ResourceService;
  let resourceRepository: Repository<Resource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourceService,
        {
          provide: getRepositoryToken(Resource),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<ResourceService>(ResourceService);
    resourceRepository = module.get<Repository<Resource>>(getRepositoryToken(Resource));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a resource', async () => {
      const createResourceDto: CreateResourceDto = {
        name: 'Tennis Court',
        type: 'tennis',
        description: 'A nice tennis court',
      };
      const resource = { ...createResourceDto, id: 1 } as Resource;
      jest.spyOn(resourceRepository, 'create').mockReturnValue(resource);
      jest.spyOn(resourceRepository, 'save').mockResolvedValue(resource);

      const result = await service.create(createResourceDto);
      expect(result).toEqual({ message: 'Resource created successfully', resource });
    });
  });

  describe('findAll', () => {
    it('should return an array of resources', async () => {
      const resources = [
        { id: 1, name: 'Tennis Court', type: 'tennis', description: 'A nice tennis court' },
        { id: 2, name: 'Swimming Pool', type: 'swimming', description: 'A large swimming pool' },
      ] as Resource[];
      jest.spyOn(resourceRepository, 'find').mockResolvedValue(resources);

      const result = await service.findAll();
      expect(result).toEqual(resources);
    });
  });

  describe('findOne', () => {
    it('should return a resource', async () => {
      const resource = { id: 1, name: 'Tennis Court', type: 'tennis', description: 'A nice tennis court' } as Resource;
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue(resource);

      const result = await service.findOne(1);
      expect(result).toEqual(resource);
    });

    it('should throw an error if resource not found', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toThrow('Resource not found');
    });
  });

  describe('update', () => {
    it('should update a resource', async () => {
      const updateResourceDto: UpdateResourceDto = {
        name: 'Updated Tennis Court',
        type: 'tennis',
        description: 'An updated nice tennis court',
      };
      const resource = { id: 1, name: 'Tennis Court', type: 'tennis', description: 'A nice tennis court' } as Resource;
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue(resource);
      jest.spyOn(resourceRepository, 'save').mockResolvedValue({ ...resource, ...updateResourceDto });

      const result = await service.update(1, updateResourceDto);
      expect(result).toEqual({ message: 'Resource updated successfully', resource: { ...resource, ...updateResourceDto } });
    });

    it('should throw an error if resource not found', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue(null);

      await expect(service.update(1, {} as UpdateResourceDto)).rejects.toThrow('Resource not found');
    });
  });

  describe('remove', () => {
    it('should remove a resource', async () => {
      const resource = { id: 1, name: 'Tennis Court', type: 'tennis', description: 'A nice tennis court' } as Resource;
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue(resource);
      jest.spyOn(resourceRepository, 'remove').mockResolvedValue(resource);

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'Resource removed successfully' });
    });

    it('should throw an error if resource not found', async () => {
      jest.spyOn(resourceRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove(1)).rejects.toThrow('Resource not found');
    });
  });
});
