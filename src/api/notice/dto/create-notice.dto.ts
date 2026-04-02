import * as Joi from '@hapi/joi';
import {
  NOTICE_CONTENT_MAX_LENGTH,
  NOTICE_SUBTITLE_MAX_LENGTH,
  NOTICE_TITLE_MAX_LENGTH,
} from '../constants/notice.constants';

export const CreateNoticeSchema = Joi.object({
  title: Joi.string().trim().max(NOTICE_TITLE_MAX_LENGTH).required(),
  subtitle: Joi.string().trim().max(NOTICE_SUBTITLE_MAX_LENGTH).allow('', null).optional(),
  content: Joi.string().trim().max(NOTICE_CONTENT_MAX_LENGTH).required(),
  sendViaWhatsapp: Joi.boolean().optional(),
});

export class CreateNoticeDto {
  title!: string;
  subtitle?: string;
  content!: string;
  sendViaWhatsapp?: boolean;
}
