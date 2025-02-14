import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateResourceDto } from '../dto/create-resource.dto';
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
    return this.resourceRepository.findOne({ where: { id: resourceId } });
  }
}
