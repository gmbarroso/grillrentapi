import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { User } from './entities/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../../shared/auth/strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from '../../shared/auth/jwt-secret.policy';
import { RevokedToken } from '../../shared/auth/entities/revoked-token.entity';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationContactEmailSettings } from '../message/entities/organization-contact-email-settings.entity';
import { EmailModule } from '../../shared/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RevokedToken, Organization, OrganizationContactEmailSettings]),
    PassportModule,
    EmailModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: resolveJwtSecret(
          configService.get<string>('JWT_SECRET'),
          configService.get<string>('NODE_ENV'),
        ),
        signOptions: { expiresIn: '60m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UserController],
  providers: [UserService, JwtStrategy, JwtAuthGuard],
  exports: [UserService, TypeOrmModule, JwtAuthGuard],
})
export class UserModule {}
