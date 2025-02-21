import * as Joi from '@hapi/joi';

export class LoginUserDto {
  apartment!: string;
  block!: number;
  password!: string;
}

export const LoginUserSchema = Joi.object({
  apartment: Joi.string().required(),
  block: Joi.number().valid(1, 2).required(),
  password: Joi.string().min(8).max(12).required(),
});
