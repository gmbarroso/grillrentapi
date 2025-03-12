import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourceService } from './services/resource.service';
import { ResourceController } from './controllers/resource.controller';
import { Resource } from './entities/resource.entity';
import { AuthService } from '../../shared/auth/services/auth.service';
import { JwtService } from '@nestjs/jwt';
import { RevokedToken } from '../../shared/auth/entities/revoked-token.entity';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resource, RevokedToken, User]),
    UserModule,
  ],
  controllers: [ResourceController],
  providers: [ResourceService, AuthService, JwtService],
  exports: [ResourceService],
})
export class ResourceModule {}
