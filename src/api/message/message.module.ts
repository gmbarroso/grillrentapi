import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageController } from './controllers/message.controller';
import { ContactEmailSettingsController } from './controllers/contact-email-settings.controller';
import { Message } from './entities/message.entity';
import { MessageReply } from './entities/message-reply.entity';
import { OrganizationContactEmailSettings } from './entities/organization-contact-email-settings.entity';
import { MessageService } from './services/message.service';
import { ContactEmailSettingsService } from './services/contact-email-settings.service';
import { EmailReplyTokenService } from './services/email-reply-token.service';
import { User } from '../user/entities/user.entity';
import { EmailModule } from '../../shared/email/email.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message, MessageReply, User, OrganizationContactEmailSettings]), EmailModule, UserModule],
  controllers: [MessageController, ContactEmailSettingsController],
  providers: [MessageService, ContactEmailSettingsService, EmailReplyTokenService],
  exports: [MessageService, ContactEmailSettingsService, EmailReplyTokenService],
})
export class MessageModule {}
