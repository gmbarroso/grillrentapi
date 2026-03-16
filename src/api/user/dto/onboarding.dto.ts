import * as Joi from '@hapi/joi';

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
  currentPassword: Joi.string().min(8).max(100).required(),
  newPassword: Joi.string().min(8).max(100).required(),
});

export interface UserOnboardingStatusDto {
  mustProvideEmail: boolean;
  mustVerifyEmail: boolean;
  mustChangePassword: boolean;
  onboardingRequired: boolean;
  isOnboardingComplete: boolean;
}
