import * as Joi from '@hapi/joi';

export const CreateResourceSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('hourly', 'daily').required(),
  description: Joi.string().max(160).optional(),
});

export class CreateResourceDto {
  name!: string;
  type!: 'hourly' | 'daily';
  description?: string;
}
