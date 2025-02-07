import { Module } from '@nestjs.common';
import { ResourceService } from './resource.service';
import { ResourceController } from './resource.controller';
import { ResourceRepository } from './resource.repository';

@Module({
  providers: [ResourceService, ResourceRepository],
  controllers: [ResourceController],
  exports: [ResourceService],
})
export class ResourceModule {}
