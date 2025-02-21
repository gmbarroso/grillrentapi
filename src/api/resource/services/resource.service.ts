import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
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
    this.logger.log(`Creating resource with type: ${createResourceDto.type}`);
    const existingResource = await this.resourceRepository.findOne({ where: { type: createResourceDto.type } });
    if (existingResource) {
      this.logger.warn(`Resource with type: ${createResourceDto.type} already exists`);
      throw new ConflictException('Resource with this type already exists');
    }
    const resource = this.resourceRepository.create(createResourceDto);
    await this.resourceRepository.save(resource);
    this.logger.log(`Resource created successfully with type: ${createResourceDto.type}`);
    return { message: 'Resource created successfully' };
  }

  async findAll() {
    this.logger.log('Fetching all resources');
    return this.resourceRepository.find();
  }

  async findOne(id: string) {
    this.logger.log(`Fetching resource with ID: ${id}`);
    const resource = await this.resourceRepository.findOne({ where: { id } });
    if (!resource) {
      this.logger.warn(`Resource with ID: ${id} not found`);
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }
    return resource;
  }

  async update(id: string, updateResourceDto: UpdateResourceDto) {
    this.logger.log(`Updating resource with ID: ${id}`);
    const resource = await this.resourceRepository.preload({
      id,
      ...updateResourceDto,
    });
    if (!resource) {
      this.logger.warn(`Resource with ID: ${id} not found`);
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }
    return this.resourceRepository.save(resource);
  }

  async remove(id: string) {
    this.logger.log(`Removing resource with ID: ${id}`);
    const resource = await this.resourceRepository.findOne({ where: { id } });
    if (!resource) {
      this.logger.warn(`Resource with ID: ${id} not found`);
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }
    await this.resourceRepository.remove(resource);
    this.logger.log(`Resource removed successfully with ID: ${id}`);
    return { message: 'Resource removed successfully' };
  }
}
