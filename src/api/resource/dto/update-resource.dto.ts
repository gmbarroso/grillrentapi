import * as Joi from '@hapi/joi';

export const UpdateResourceSchema = Joi.object({
  name: Joi.string().optional(),
  type: Joi.string().optional(),
});

export class UpdateResourceDto {
  name?: string;
  type?: string;
}
