import { Test, TestingModule } from '@nestjs/testing';
import { ResourceService } from './resource.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Resource } from '../entities/resource.entity';
import { Repository } from 'typeorm';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { UpdateResourceDto } from '../dto/update-resource.dto';
import { NotFoundException } from '@nestjs/common';

describe('ResourceService', () => {
  let service: ResourceService;
  let repository: jest.Mocked<Repository<Resource>>;

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
    repository = module.get<Repository<Resource>>(getRepositoryToken(Resource)) as jest.Mocked<Repository<Resource>>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a resource', async () => {
      const createResourceDto: CreateResourceDto = {
        name: 'Test Resource',
        type: 'Test Type'
      };
      const resource: Resource = { id: '1', ...createResourceDto, bookings: [] };
      const result = { message: 'Resource created successfully' };

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockReturnValue(resource as any);
      jest.spyOn(repository, 'save').mockResolvedValue(resource as any);

      console.log(createResourceDto);
      console.log(await service.create(createResourceDto))

      expect(await service.create(createResourceDto)).toEqual(result);
    });
  });

  describe('findAll', () => {
    it('should find all resources', async () => {
      const resources: Resource[] = [
        { id: '1', name: 'Test Resource 1', type: 'Test Type 1', bookings: [] },
        { id: '2', name: 'Test Resource 2', type: 'Test Type 2', bookings: [] },
      ];

      jest.spyOn(repository, 'find').mockResolvedValue(resources as any);

      expect(await service.findAll()).toEqual(resources);
    });
  });

  describe('findOne', () => {
    it('should find one resource', async () => {
      const resource: Resource = { id: '1', name: 'Test Resource', type: 'Test Type', bookings: [] };

      jest.spyOn(repository, 'findOne').mockResolvedValue(resource as any);

      expect(await service.findOne('1')).toEqual(resource);
    });

    it('should throw a NotFoundException if resource not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a resource', async () => {
      const updateResourceDto: UpdateResourceDto = {
        name: 'Updated Resource',
        type: 'Updated Type',
      };
      const resource: Resource = { 
        id: '1', 
        name: updateResourceDto.name || 'Default Name', 
        type: updateResourceDto.type || 'Default Type',
        bookings: [] 
      };
      const result = { message: 'Resource updated successfully', resource };

      jest.spyOn(repository, 'findOne').mockResolvedValue(resource as any);
      jest.spyOn(repository, 'preload').mockResolvedValue(resource as any);
      jest.spyOn(repository, 'save').mockResolvedValue(resource as any);

      expect(await service.update('1', updateResourceDto)).toEqual(resource);
    });

    it('should throw a NotFoundException if resource not found', async () => {
      jest.spyOn(repository, 'preload').mockResolvedValue(undefined);

      await expect(service.update('1', {} as UpdateResourceDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a resource', async () => {
      const resource: Resource = { id: '1', name: 'Test Resource', type: 'Test Type', bookings: [] };
      const result = { message: 'Resource removed successfully' };

      jest.spyOn(repository, 'findOne').mockResolvedValue(resource as any);
      jest.spyOn(repository, 'remove').mockResolvedValue(resource as any);

      expect(await service.remove('1')).toEqual(result);
    });

    it('should throw a NotFoundException if resource not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });
});
