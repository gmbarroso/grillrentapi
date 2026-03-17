import * as Joi from '@hapi/joi';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../../../shared/validation/password-policy';

export const UpdateUserSchema = Joi.object({
  name: Joi.string().optional(),
  password: Joi.string()
    .pattern(PASSWORD_POLICY_REGEX)
    .optional()
    .messages({
      'string.pattern.base': PASSWORD_POLICY_MESSAGE,
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
