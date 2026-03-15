import * as Joi from '@hapi/joi';

export const CreateMessageReplySchema = Joi.object({
  content: Joi.string().trim().max(4000).required(),
  sendViaEmail: Joi.boolean().optional(),
});

export class CreateMessageReplyDto {
  content!: string;
  sendViaEmail?: boolean;
}
