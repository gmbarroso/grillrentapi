import * as Joi from '@hapi/joi';

export const UpdateResourceSchema = Joi.object({
  name: Joi.string().optional(),
  type: Joi.string().valid('hourly', 'daily').optional(),
  description: Joi.string().max(160).allow('', null).optional(),
});

export class UpdateResourceDto {
  name?: string;
  type?: 'hourly' | 'daily';
  description?: string | null;
}
