import * as Joi from '@hapi/joi';

const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])(?=\S+$).{8,100}$/;

export class ForgotPasswordRequestDto {
  organizationSlug!: string;
  email!: string;
}

export const ForgotPasswordRequestSchema = Joi.object({
  organizationSlug: Joi.string().trim().required(),
  email: Joi.string().trim().email().max(100).required(),
});

export class ForgotPasswordConfirmDto {
  organizationSlug!: string;
  token!: string;
  newPassword!: string;
}

export const ForgotPasswordConfirmSchema = Joi.object({
  organizationSlug: Joi.string().trim().required(),
  token: Joi.string().trim().min(20).max(512).required(),
  newPassword: Joi.string()
    .pattern(PASSWORD_POLICY_REGEX)
    .required()
    .messages({
      'string.pattern.base': 'Password must have at least 8 chars, one uppercase letter, one number, and one special character',
    }),
});
