import * as Joi from '@hapi/joi';
import { UserRole } from '../entities/user.entity';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../../../shared/validation/password-policy';

export class CreateUserDto {
  name!: string;
  email?: string | null;
  password!: string;
  apartment!: string;
  block!: number;
  role!: UserRole;
}

export const CreateUserSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().trim().email().allow('', null).optional(),
  password: Joi.string()
    .pattern(PASSWORD_POLICY_REGEX)
    .required()
    .messages({
      'string.pattern.base': PASSWORD_POLICY_MESSAGE,
    }),
  apartment: Joi.string().required(),
  block: Joi.number().valid(1, 2).required(),
  role: Joi.string().valid(UserRole.ADMIN, UserRole.RESIDENT).default(UserRole.RESIDENT),
});
