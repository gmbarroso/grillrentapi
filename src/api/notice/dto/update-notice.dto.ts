import * as Joi from '@hapi/joi';
import {
  NOTICE_CONTENT_MAX_LENGTH,
  NOTICE_SUBTITLE_MAX_LENGTH,
  NOTICE_TITLE_MAX_LENGTH,
} from '../constants/notice.constants';

export const UpdateNoticeSchema = Joi.object({
  title: Joi.string().trim().max(NOTICE_TITLE_MAX_LENGTH).optional(),
  subtitle: Joi.string().trim().max(NOTICE_SUBTITLE_MAX_LENGTH).allow('', null).optional(),
  content: Joi.string().trim().max(NOTICE_CONTENT_MAX_LENGTH).optional(),
}).min(1);

export class UpdateNoticeDto {
  title?: string;
  subtitle?: string;
  content?: string;
}
