import * as Joi from '@hapi/joi';

const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])(?=\S+$).{8,100}$/;

export class SetOnboardingEmailDto {
  email!: string;
}

export const SetOnboardingEmailSchema = Joi.object({
  email: Joi.string().trim().email().max(100).required(),
});

export class VerifyOnboardingEmailDto {
  token!: string;
}

export const VerifyOnboardingEmailSchema = Joi.object({
  token: Joi.string().trim().min(20).max(512).required(),
});

export class ChangeOnboardingPasswordDto {
  currentPassword!: string;
  newPassword!: string;
}

export const ChangeOnboardingPasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(100).required(),
  newPassword: Joi.string()
    .pattern(PASSWORD_POLICY_REGEX)
    .required()
    .messages({
      'string.pattern.base': 'Password must have at least 8 chars, one uppercase letter, one number, and one special character',
    }),
});

export class ChangePasswordDto {
  currentPassword!: string;
  newPassword!: string;
}

export const ChangePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(100).required(),
  newPassword: Joi.string()
    .pattern(PASSWORD_POLICY_REGEX)
    .required()
    .messages({
      'string.pattern.base': 'Password must have at least 8 chars, one uppercase letter, one number, and one special character',
    }),
});

export interface UserOnboardingStatusDto {
  mustProvideEmail: boolean;
  mustVerifyEmail: boolean;
  mustChangePassword: boolean;
  onboardingRequired: boolean;
  isOnboardingComplete: boolean;
}
