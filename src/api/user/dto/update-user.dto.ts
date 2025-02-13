import * as Joi from '@hapi/joi';

export const UpdateUserSchema = Joi.object({
  username: Joi.string().optional(),
  password: Joi.string().min(8).optional(),
  email: Joi.string().email().optional(),
  apartment: Joi.string().optional(),
});

export class UpdateUserDto {
  username?: string;
  password?: string;
  email?: string;
  apartment?: string;
}
