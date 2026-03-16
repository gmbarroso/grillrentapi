import * as Joi from '@hapi/joi';
import { ContactEmailDeliveryMode, ContactEmailReplyToMode } from '../entities/organization-contact-email-settings.entity';

export const UpdateContactEmailSettingsSchema = Joi.object({
  deliveryMode: Joi.string().valid('in_app_only', 'in_app_and_email').required(),
  recipientEmails: Joi.array().items(Joi.string().trim().email().max(150)).default([]),
  fromName: Joi.string().trim().max(120).allow('', null).optional(),
  fromEmail: Joi.string().trim().email().max(150).allow('', null).optional(),
  replyToMode: Joi.string().valid('resident_email', 'custom').required(),
  customReplyTo: Joi.string().trim().email().max(150).allow('', null).optional(),
  smtpHost: Joi.string().trim().max(255).allow('', null).optional(),
  smtpPort: Joi.number().integer().min(1).max(65535).allow(null).optional(),
  smtpSecure: Joi.boolean().allow(null).optional(),
  smtpUser: Joi.string().trim().max(255).allow('', null).optional(),
  smtpFrom: Joi.string().trim().email().max(255).allow('', null).optional(),
  smtpAppPassword: Joi.string().trim().max(255).allow('', null).optional(),
});

export class UpdateContactEmailSettingsDto {
  deliveryMode!: ContactEmailDeliveryMode;
  recipientEmails?: string[];
  fromName?: string | null;
  fromEmail?: string | null;
  replyToMode!: ContactEmailReplyToMode;
  customReplyTo?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
  smtpUser?: string | null;
  smtpFrom?: string | null;
  smtpAppPassword?: string | null;
}

export interface ContactEmailSettingsViewDto {
  deliveryMode: ContactEmailDeliveryMode;
  recipientEmails: string[];
  fromName: string | null;
  fromEmail: string | null;
  replyToMode: ContactEmailReplyToMode;
  customReplyTo: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpFrom: string | null;
  hasSmtpPassword: boolean;
  canSendEmail: boolean;
  validationErrors: string[];
}
