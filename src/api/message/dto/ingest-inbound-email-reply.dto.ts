import * as Joi from '@hapi/joi';

export const IngestInboundEmailReplySchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  messageId: Joi.string().uuid().required(),
  fromEmail: Joi.string().trim().email().max(150).required(),
  content: Joi.string().trim().max(10000).required(),
  externalMessageId: Joi.string().trim().max(255).allow('', null).optional(),
  subject: Joi.string().trim().max(255).allow('', null).optional(),
  receivedAt: Joi.date().iso().optional(),
});

export class IngestInboundEmailReplyDto {
  organizationId!: string;
  messageId!: string;
  fromEmail!: string;
  content!: string;
  externalMessageId?: string | null;
  subject?: string | null;
  receivedAt?: string;
}
