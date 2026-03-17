import * as Joi from '@hapi/joi';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../../../shared/validation/password-policy';

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
      'string.pattern.base': PASSWORD_POLICY_MESSAGE,
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
      'string.pattern.base': PASSWORD_POLICY_MESSAGE,
    }),
});

export interface UserOnboardingStatusDto {
  mustProvideEmail: boolean;
  mustVerifyEmail: boolean;
  mustChangePassword: boolean;
  onboardingRequired: boolean;
  isOnboardingComplete: boolean;
}
