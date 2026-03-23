import * as Joi from '@hapi/joi';
import { ContactMessageCategory } from '../entities/message.entity';

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 1 * 1024 * 1024;
const IMAGE_DATA_URL_REGEX = /^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,[a-z0-9+/=]+$/i;

const estimateDataUrlBytes = (dataUrl: string): number => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return Number.POSITIVE_INFINITY;

  const base64Payload = dataUrl.slice(commaIndex + 1);
  const normalizedPayload = base64Payload.replace(/\s/g, '');
  const paddingChars = normalizedPayload.endsWith('==') ? 2 : normalizedPayload.endsWith('=') ? 1 : 0;
  return Math.floor((normalizedPayload.length * 3) / 4) - paddingChars;
};

const contactAttachmentSchema = Joi.string()
  .trim()
  .custom((value: string, helpers) => {
    if (!IMAGE_DATA_URL_REGEX.test(value)) {
      return helpers.error('any.invalid');
    }

    if (estimateDataUrlBytes(value) > MAX_ATTACHMENT_SIZE_BYTES) {
      return helpers.error('any.invalid');
    }

    return value;
  })
  .messages({
    'any.invalid': `attachments must contain valid image data URLs up to ${MAX_ATTACHMENT_SIZE_BYTES} bytes each`,
  });

export const CreateMessageSchema = Joi.object({
  subject: Joi.string().trim().max(255).required(),
  category: Joi.string().valid('suggestion', 'complaint', 'question').required(),
  content: Joi.string().trim().max(4000).required(),
  attachments: Joi.array().items(contactAttachmentSchema).max(MAX_ATTACHMENTS).optional(),
});

export class CreateMessageDto {
  subject!: string;
  category!: ContactMessageCategory;
  content!: string;
  attachments?: string[];
}
