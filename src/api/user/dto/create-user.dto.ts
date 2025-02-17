import * as Joi from '@hapi/joi';

export class CreateUserDto {
  name: string;
  email: string;
  password: string;
  apartment: string;
}

export const CreateUserSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  apartment: Joi.string().required(),
});
