import * as Joi from '@hapi/joi';

export const CreateUserSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().min(8).required(),
  email: Joi.string().email().required(),
  apartment: Joi.string().required(),
});

export class CreateUserDto {
  username: string;
  password: string;
  email: string;
  apartment: string;
}
