import * as Joi from '@hapi/joi';

export const UpdateUserSchema = Joi.object({
  name: Joi.string().optional(),
  password: Joi.string().min(8).optional(),
  email: Joi.string().trim().email().allow('', null).optional(),
  apartment: Joi.string().optional(),
  block: Joi.number().valid(1, 2).optional(),
});

export class UpdateUserDto {
  name?: string;
  password?: string;
  email?: string | null;
  apartment?: string;
  block?: number;
}
