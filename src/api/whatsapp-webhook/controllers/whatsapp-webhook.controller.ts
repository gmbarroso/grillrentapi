import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { WhatsappWebhookService } from '../services/whatsapp-webhook.service';

@Controller('webhooks/whatsapp/evolution')
export class WhatsappWebhookController {
  constructor(private readonly whatsappWebhookService: WhatsappWebhookService) {}

  @Post()
  @HttpCode(200)
  async handleEvolutionWebhook(
    @Body() payload: unknown,
    @Headers('x-webhook-secret') webhookSecret?: string,
  ): Promise<{
    ok: boolean;
    status:
      | 'ignored_invalid_payload'
      | 'ignored_non_group_message'
      | 'ignored_group_not_bound'
      | 'duplicate'
      | 'ignored_not_admin'
      | 'ignored_no_text'
      | 'created';
    reason?: string;
    noticeId?: string;
  }> {
    return this.whatsappWebhookService.handleEvolutionWebhook(payload, webhookSecret);
  }
}
