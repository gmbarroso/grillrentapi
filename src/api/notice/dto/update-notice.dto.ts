import * as Joi from '@hapi/joi';

export const UpdateNoticeSchema = Joi.object({
  title: Joi.string().trim().max(255).optional(),
  subtitle: Joi.string().trim().max(255).allow('', null).optional(),
  content: Joi.string().trim().max(2000).optional(),
}).min(1);

export class UpdateNoticeDto {
  title?: string;
  subtitle?: string;
  content?: string;
}
