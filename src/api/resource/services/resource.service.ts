import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { UpdateResourceDto } from '../dto/update-resource.dto';
import { Resource } from '../entities/resource.entity';

@Injectable()
export class ResourceService {
  private readonly logger = new Logger(ResourceService.name);

  constructor(
    @InjectRepository(Resource)
    private readonly resourceRepository: Repository<Resource>,
  ) {}

  async create(createResourceDto: CreateResourceDto) {
    this.logger.log(`Creating resource: ${createResourceDto.name}`);
    const resource = this.resourceRepository.create(createResourceDto);
    await this.resourceRepository.save(resource);
    this.logger.log(`Resource created successfully: ${resource.id}`);
    return { message: 'Resource created successfully', resource };
  }

  async findAll() {
    this.logger.log('Fetching all resources');
    return this.resourceRepository.find();
  }

  async findOne(resourceId: number) {
    this.logger.log(`Fetching resource ID: ${resourceId}`);
    const resource = await this.resourceRepository.findOne({ where: { id: resourceId } });
    if (!resource) {
      throw new NotFoundException('Resource not found');
    }
    return resource;
  }

  async update(id: number, updateResourceDto: UpdateResourceDto) {
    const resource = await this.resourceRepository.findOne({ where: { id } });
    if (!resource) {
      throw new NotFoundException('Resource not found');
    }
    const updatedResource = Object.assign(resource, updateResourceDto);
    await this.resourceRepository.save(updatedResource);
    this.logger.log(`Resource updated successfully: ${updatedResource.id}`);
    return { message: 'Resource updated successfully', resource: updatedResource };
  }

  async remove(id: number) {
    const resource = await this.resourceRepository.findOne({ where: { id } });
    if (!resource) {
      throw new NotFoundException('Resource not found');
    }
    await this.resourceRepository.remove(resource);
    this.logger.log(`Resource removed successfully: ${id}`);
    return { message: 'Resource removed successfully' };
  }
}
