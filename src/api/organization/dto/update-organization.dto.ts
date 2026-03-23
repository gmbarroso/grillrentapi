import * as Joi from '@hapi/joi';
import { isDataImageUrl, isHttpUrl } from './logo-url.validation';

export class UpdateOrganizationDto {
  name?: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  businessHours?: string | null;
  timezone?: string;
  openingTime?: string | null;
  closingTime?: string | null;
  logoUrl?: string | null;
}

export const UpdateOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  address: Joi.string().max(1000).allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  phone: Joi.string().max(40).allow('', null).optional(),
  businessHours: Joi.string().max(240).allow('', null).optional(),
  timezone: Joi.string().max(64).optional(),
  openingTime: Joi.string().pattern(/^\d{2}:\d{2}$/).allow('', null).optional(),
  closingTime: Joi.string().pattern(/^\d{2}:\d{2}$/).allow('', null).optional(),
  logoUrl: Joi.string()
    .trim()
    .max(2_000_000)
    .allow('', null)
    .custom((value, helpers) => {
      if (!value) return value;
      if (isHttpUrl(value) || isDataImageUrl(value)) {
        return value;
      }
      return helpers.error('any.invalid');
    }, 'organization logo URL validation')
    .messages({ 'any.invalid': 'logoUrl must be an http(s) URL or a base64 data:image value' })
    .optional(),
}).min(1);
