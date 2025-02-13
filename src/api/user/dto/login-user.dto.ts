import * as Joi from '@hapi/joi';

export const LoginUserSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

export class LoginUserDto {
  username: string;
  password: string;
}
