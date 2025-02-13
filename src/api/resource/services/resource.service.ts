import { Injectable } from '@nestjs/common';
import { CreateResourceDto } from '../dto/create-resource.dto';

@Injectable()
export class ResourceService {
  private resources: { id: number; name: string; type: string; description?: string }[] = [];

  async create(createResourceDto: CreateResourceDto) {
    const resource = { id: Date.now(), ...createResourceDto };
    this.resources.push(resource);
    return resource;
  }

  async findAll() {
    return this.resources;
  }
}
