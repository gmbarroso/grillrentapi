import { Module } from '@nestjs/common';
import { ResourceService } from './services/resource.service';
import { ResourceController } from './controllers/resource.controller';

@Module({
  controllers: [ResourceController],
  providers: [ResourceService],
  exports: [ResourceService],
})
export class ResourceModule {}
