import * as Joi from '@hapi/joi';

export const UpdateUserSchema = Joi.object({
  name: Joi.string().optional(),
  password: Joi.string().min(8).optional(),
  email: Joi.string().email().optional(),
  apartment: Joi.string().optional(),
  block: Joi.number().valid(1, 2).optional(),
});

export class UpdateUserDto {
  name?: string;
  password?: string;
  email?: string;
  apartment?: string;
  block?: number;
}
