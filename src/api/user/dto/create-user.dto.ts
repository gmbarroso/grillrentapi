import * as Joi from '@hapi/joi';
import { UserRole } from '../entities/user.entity';

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
  password: Joi.string().min(8).required(),
  apartment: Joi.string().required(),
  block: Joi.number().valid(1, 2).required(),
  role: Joi.string().valid(UserRole.ADMIN, UserRole.RESIDENT).default(UserRole.RESIDENT),
});
