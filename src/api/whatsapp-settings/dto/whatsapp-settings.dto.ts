import * as Joi from '@hapi/joi';

export const UpdateWhatsappSettingsSchema = Joi.object({
  baseUrl: Joi.string().trim().uri({ scheme: ['http', 'https'] }).required(),
  instanceName: Joi.string().trim().max(120).required(),
  apiKey: Joi.string().trim().max(500).allow('', null).optional(),
  whatsappNumber: Joi.string().trim().max(40).allow('', null).optional(),
  autoSendNotices: Joi.boolean().optional(),
});

export const TestWhatsappConnectionSchema = Joi.object({
  baseUrl: Joi.string().trim().uri({ scheme: ['http', 'https'] }).optional(),
  instanceName: Joi.string().trim().max(120).optional(),
  apiKey: Joi.string().trim().max(500).optional(),
});

export const UpsertWhatsappGroupBindingSchema = Joi.object({
  groupJid: Joi.string().trim().max(191).required(),
  groupName: Joi.string().trim().max(180).allow('', null).optional(),
});

export const OnboardingStatusQuerySchema = Joi.object({
  forceQr: Joi.boolean().optional(),
});

export class UpdateWhatsappSettingsDto {
  baseUrl!: string;
  instanceName!: string;
  apiKey?: string | null;
  whatsappNumber?: string | null;
  autoSendNotices?: boolean;
}

export class TestWhatsappConnectionDto {
  baseUrl?: string;
  instanceName?: string;
  apiKey?: string;
}

export class UpsertWhatsappGroupBindingDto {
  groupJid!: string;
  groupName?: string | null;
}

export class OnboardingStatusQueryDto {
  forceQr?: boolean;
}

export type WhatsappOnboardingState =
  | 'creating_instance'
  | 'qr_ready'
  | 'connecting'
  | 'group_selection'
  | 'active'
  | 'failed';

export interface WhatsappOnboardingStatusDto {
  state: WhatsappOnboardingState;
  status: 'connected' | 'disconnected';
  instanceName: string;
  qrCodeBase64: string | null;
  ttlSeconds: number | null;
  statusEndpoint: string;
  maskedWhatsappNumber: string | null;
}

export interface WhatsappGroupOptionDto {
  groupJid: string;
  groupName: string;
}

export interface WhatsappGroupBindingDto {
  feature: string;
  groupJid: string;
  groupName: string | null;
}

export interface WhatsappSettingsViewDto {
  provider: string;
  status: 'connected' | 'disconnected';
  baseUrl: string;
  instanceName: string;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  whatsappNumber: string | null;
  autoSendNotices: boolean;
  noticeGroupJid: string | null;
  noticeGroupName: string | null;
}
