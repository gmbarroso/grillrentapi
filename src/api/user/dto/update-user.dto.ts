import * as Joi from '@hapi/joi';

const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])(?=\S+$).{8,100}$/;

export const UpdateUserSchema = Joi.object({
  name: Joi.string().optional(),
  password: Joi.string()
    .pattern(PASSWORD_POLICY_REGEX)
    .optional()
    .messages({
      'string.pattern.base': 'Password must have at least 8 chars, one uppercase letter, one number, and one special character',
    }),
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
