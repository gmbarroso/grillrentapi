import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageController } from './controllers/message.controller';
import { ContactEmailSettingsController } from './controllers/contact-email-settings.controller';
import { Message } from './entities/message.entity';
import { OrganizationContactEmailSettings } from './entities/organization-contact-email-settings.entity';
import { MessageService } from './services/message.service';
import { ContactEmailSettingsService } from './services/contact-email-settings.service';
import { User } from '../user/entities/user.entity';
import { EmailModule } from '../../shared/email/email.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message, User, OrganizationContactEmailSettings]), EmailModule, UserModule],
  controllers: [MessageController, ContactEmailSettingsController],
  providers: [MessageService, ContactEmailSettingsService],
  exports: [MessageService, ContactEmailSettingsService],
})
export class MessageModule {}
