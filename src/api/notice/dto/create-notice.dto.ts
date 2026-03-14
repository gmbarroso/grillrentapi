import * as Joi from '@hapi/joi';

export const CreateNoticeSchema = Joi.object({
  title: Joi.string().trim().max(255).required(),
  subtitle: Joi.string().trim().max(255).allow('', null).optional(),
  content: Joi.string().trim().max(2000).required(),
  sendViaWhatsapp: Joi.boolean().optional(),
});

export class CreateNoticeDto {
  title!: string;
  subtitle?: string;
  content!: string;
  sendViaWhatsapp?: boolean;
}
