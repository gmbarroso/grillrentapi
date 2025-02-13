import * as Joi from '@hapi/joi';

export const CreateResourceSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('grill', 'tennis court').required(),
  description: Joi.string().optional(),
});

export class CreateResourceDto {
  name: string;
  type: string;
  description?: string;
}
