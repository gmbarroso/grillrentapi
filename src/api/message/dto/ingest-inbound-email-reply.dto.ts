import * as Joi from '@hapi/joi';

export const IngestInboundEmailReplySchema = Joi.object({
  organizationId: Joi.string().uuid().optional(),
  messageId: Joi.string().uuid().optional(),
  fromEmail: Joi.string().trim().email().max(150).required(),
  content: Joi.string().trim().max(10000).required(),
  externalMessageId: Joi.string().trim().max(255).allow('', null).optional(),
  subject: Joi.string().trim().max(255).allow('', null).optional(),
  receivedAt: Joi.date().iso().optional(),
  threadMessageIds: Joi.array().items(Joi.string().trim().max(255)).max(50).optional(),
  toRecipients: Joi.array().items(Joi.string().trim().max(320)).max(50).optional(),
  deliveredToRecipients: Joi.array().items(Joi.string().trim().max(320)).max(50).optional(),
  xOriginalToRecipients: Joi.array().items(Joi.string().trim().max(320)).max(50).optional(),
});

export class IngestInboundEmailReplyDto {
  organizationId?: string;
  messageId?: string;
  fromEmail!: string;
  content!: string;
  externalMessageId?: string | null;
  subject?: string | null;
  receivedAt?: string;
  threadMessageIds?: string[];
  toRecipients?: string[];
  deliveredToRecipients?: string[];
  xOriginalToRecipients?: string[];
}
