import * as Joi from '@hapi/joi';

export const UpdateWhatsappSettingsSchema = Joi.object({
  baseUrl: Joi.string().trim().uri({ scheme: ['http', 'https'] }).required(),
  instanceName: Joi.string().trim().max(120).required(),
  apiKey: Joi.string().trim().max(500).allow('').optional(),
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

export class UpdateWhatsappSettingsDto {
  baseUrl!: string;
  instanceName!: string;
  apiKey?: string;
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
