import * as Joi from '@hapi/joi';

export class LoginUserDto {
  name: string;
  password: string;
}

export const LoginUserSchema = Joi.object({
  name: Joi.string().required(),
  password: Joi.string().min(8).max(12).required(),
});
