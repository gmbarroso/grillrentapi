import { Injectable } from '@nestjs/common';
import { ResourceRepository } from './resource.repository';
import { Resource } from '../entities/resource.entity';

@Injectable()
export class ResourceService {
  constructor(private readonly resourceRepository: ResourceRepository) {}

  async create(resource: Partial<Resource>): Promise<Resource> {
    return this.resourceRepository.create(resource);
  }

  async findAll(): Promise<Resource[]> {
    return this.resourceRepository.findAll();
  }

  async findOne(id: number): Promise<Resource> {
    return this.resourceRepository.findOne(id);
  }

  async update(id: number, resource: Partial<Resource>): Promise<Resource> {
    return this.resourceRepository.update(id, resource);
  }

  async remove(id: number): Promise<void> {
    return this.resourceRepository.remove(id);
  }
}
