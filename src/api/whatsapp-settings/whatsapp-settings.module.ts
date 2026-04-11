import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationWhatsappIntegration } from './entities/organization-whatsapp-integration.entity';
import { OrganizationWhatsappGroupBinding } from './entities/organization-whatsapp-group-binding.entity';
import { WhatsappSettingsController } from './controllers/whatsapp-settings.controller';
import { WhatsappSettingsService } from './services/whatsapp-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, OrganizationWhatsappIntegration, OrganizationWhatsappGroupBinding]),
    UserModule,
  ],
  controllers: [WhatsappSettingsController],
  providers: [WhatsappSettingsService],
  exports: [WhatsappSettingsService],
})
export class WhatsappSettingsModule {}
