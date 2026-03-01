import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationController } from './controllers/organization.controller';
import { Organization } from './entities/organization.entity';
import { OrganizationService } from './services/organization.service';
import { InternalServiceAuthGuard } from '../../shared/auth/guards/internal-service-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  controllers: [OrganizationController],
  providers: [OrganizationService, InternalServiceAuthGuard],
  exports: [OrganizationService],
})
export class OrganizationModule {}
