import * as Joi from '@hapi/joi';

export const CreateResourceSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().required(),
  description: Joi.string().required(),
});

export class CreateResourceDto {
  name: string;
  type: string;
  description: string;
}
