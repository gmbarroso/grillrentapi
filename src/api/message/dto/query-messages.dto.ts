import * as Joi from '@hapi/joi';
import { ContactMessageCategory, ContactMessageStatus } from '../entities/message.entity';

export const QueryMessagesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  category: Joi.string().valid('suggestion', 'complaint', 'question').optional(),
  status: Joi.string().valid('unread', 'read', 'replied').optional(),
});

export class QueryMessagesDto {
  page: number = 1;
  limit: number = 20;
  category?: ContactMessageCategory;
  status?: ContactMessageStatus;
}
