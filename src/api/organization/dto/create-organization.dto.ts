import * as Joi from '@hapi/joi';

export class CreateOrganizationDto {
  name!: string;
  slug?: string;
  address?: string;
  email?: string;
  phone?: string;
  businessHours?: string;
  timezone?: string;
  openingTime?: string;
  closingTime?: string;
  logoUrl?: string;
}

const isDataImageUrl = (value: string): boolean => /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value);
const isHttpUrl = (value: string): boolean => {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

export const CreateOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  slug: Joi.string().trim().min(1).max(120).optional(),
  address: Joi.string().max(1000).allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  phone: Joi.string().max(40).allow('', null).optional(),
  businessHours: Joi.string().max(240).allow('', null).optional(),
  timezone: Joi.string().max(64).default('America/Sao_Paulo'),
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
});
