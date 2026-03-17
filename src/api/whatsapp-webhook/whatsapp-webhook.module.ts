import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notice } from '../notice/entities/notice.entity';
import { OrganizationWhatsappGroupBinding } from '../whatsapp-settings/entities/organization-whatsapp-group-binding.entity';
import { OrganizationWhatsappIntegration } from '../whatsapp-settings/entities/organization-whatsapp-integration.entity';
import { NoticeWhatsappInboundEvent } from './entities/notice-whatsapp-inbound-event.entity';
import { WhatsappWebhookController } from './controllers/whatsapp-webhook.controller';
import { WhatsappWebhookService } from './services/whatsapp-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notice,
      OrganizationWhatsappGroupBinding,
      OrganizationWhatsappIntegration,
      NoticeWhatsappInboundEvent,
    ]),
  ],
  controllers: [WhatsappWebhookController],
  providers: [WhatsappWebhookService],
})
export class WhatsappWebhookModule {}
