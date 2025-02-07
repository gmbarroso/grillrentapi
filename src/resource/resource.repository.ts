import { Injectable } from '@nestjs/common';
import { Resource } from '../entities/resource.entity';

@Injectable()
export class ResourceRepository {
  private resources: Resource[] = [];

  async create(resource: Partial<Resource>): Promise<Resource> {
    const newResource = { id: Date.now(), ...resource } as Resource;
    this.resources.push(newResource);
    return newResource;
  }

  async findAll(): Promise<Resource[]> {
    return this.resources;
  }

  async findOne(id: number): Promise<Resource> {
    const resource = this.resources.find(resource => resource.id === id);
    if (!resource) {
      throw new Error(`Resource with id ${id} not found`);
    }
    return resource;
  }

  async update(id: number, resource: Partial<Resource>): Promise<Resource> {
    const index = this.resources.findIndex(resource => resource.id === id);
    if (index === -1) {
      throw new Error(`Resource with id ${id} not found`);
    }
    this.resources[index] = { ...this.resources[index], ...resource };
    return this.resources[index];
  }

  async remove(id: number): Promise<void> {
    this.resources = this.resources.filter(resource => resource.id !== id);
  }
}
