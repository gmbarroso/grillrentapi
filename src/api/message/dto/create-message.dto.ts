import * as Joi from '@hapi/joi';
import { ContactMessageCategory } from '../entities/message.entity';

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 1 * 1024 * 1024;
const IMAGE_DATA_URL_REGEX = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i;

const getDecodedDataUrlBytes = (dataUrl: string): number => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return Number.POSITIVE_INFINITY;

  const base64Payload = dataUrl.slice(commaIndex + 1).replace(/\s/g, '');
  if (!base64Payload || base64Payload.length % 4 !== 0) {
    return Number.POSITIVE_INFINITY;
  }

  const decodedBuffer = Buffer.from(base64Payload, 'base64');
  if (decodedBuffer.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const normalizedInput = base64Payload.replace(/=+$/, '');
  const normalizedDecoded = decodedBuffer.toString('base64').replace(/=+$/, '');
  if (normalizedInput !== normalizedDecoded) {
    return Number.POSITIVE_INFINITY;
  }

  return decodedBuffer.length;
};

const contactAttachmentSchema = Joi.string()
  .trim()
  .custom((value: string, helpers) => {
    if (!IMAGE_DATA_URL_REGEX.test(value)) {
      return helpers.error('any.invalid');
    }

    const decodedBytes = getDecodedDataUrlBytes(value);
    if (decodedBytes <= 0 || decodedBytes > MAX_ATTACHMENT_SIZE_BYTES) {
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
