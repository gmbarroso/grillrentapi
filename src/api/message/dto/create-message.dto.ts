import * as Joi from '@hapi/joi';
import { ContactMessageCategory } from '../entities/message.entity';

export const CreateMessageSchema = Joi.object({
  subject: Joi.string().trim().max(255).required(),
  category: Joi.string().valid('suggestion', 'complaint', 'question').required(),
  content: Joi.string().trim().max(4000).required(),
});

export class CreateMessageDto {
  subject!: string;
  category!: ContactMessageCategory;
  content!: string;
}
