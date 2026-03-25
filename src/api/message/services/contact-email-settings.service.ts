import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContactEmailDeliveryMode,
  ContactEmailReplyToMode,
  OrganizationContactEmailSettings,
} from '../entities/organization-contact-email-settings.entity';
import { ContactEmailSettingsViewDto, UpdateContactEmailSettingsDto } from '../dto/contact-email-settings.dto';

interface ContactEmailSettingsValidation {
  valid: boolean;
  errors: string[];
}

export type ContactEmailDeliveryConfig =
  | {
      shouldSend: false;
      deliveryMode: ContactEmailDeliveryMode;
      reason: string;
      validationErrors: string[];
    }
  | {
      shouldSend: true;
      deliveryMode: ContactEmailDeliveryMode;
      recipients: string[];
      from: string | null;
      replyTo: string | null;
      validationErrors: string[];
    };

@Injectable()
export class ContactEmailSettingsService {
  constructor(
    @InjectRepository(OrganizationContactEmailSettings)
    private readonly settingsRepository: Repository<OrganizationContactEmailSettings>,
  ) {}

  async getSettings(organizationId: string): Promise<ContactEmailSettingsViewDto> {
    const settings = await this.settingsRepository.findOne({ where: { organizationId } });
    const normalized = this.normalizeSettings(settings);
    const validation = this.validate(normalized);

    return this.toView(normalized, validation);
  }

  async updateSettings(
    organizationId: string,
    data: UpdateContactEmailSettingsDto,
  ): Promise<ContactEmailSettingsViewDto> {
    const existing = await this.settingsRepository.findOne({ where: { organizationId } });
    const payload = this.sanitizePayload(data);

    const entity = this.settingsRepository.create({
      id: existing?.id,
      organizationId,
      deliveryMode: payload.deliveryMode,
      recipientEmails: payload.recipientEmails,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail,
      replyToMode: payload.replyToMode,
      customReplyTo: payload.customReplyTo,
    });

    await this.settingsRepository.save(entity);
    return this.getSettings(organizationId);
  }

  async resolveDeliveryConfig(organizationId: string, residentEmail?: string | null): Promise<ContactEmailDeliveryConfig> {
    const settings = await this.settingsRepository.findOne({ where: { organizationId } });
    const normalized = this.normalizeSettings(settings);
    const validation = this.validate(normalized);

    if (normalized.deliveryMode === 'in_app_only') {
      return {
        shouldSend: false,
        deliveryMode: normalized.deliveryMode,
        reason: 'Delivery mode is in_app_only',
        validationErrors: [],
      };
    }

    if (!validation.valid) {
      return {
        shouldSend: false,
        deliveryMode: normalized.deliveryMode,
        reason: 'Organization contact email settings are invalid',
        validationErrors: validation.errors,
      };
    }

    const from = this.composeFromHeader(normalized.fromName, normalized.fromEmail);
    const replyTo = this.resolveReplyTo(normalized.replyToMode, normalized.customReplyTo, residentEmail ?? null);

    return {
      shouldSend: true,
      deliveryMode: normalized.deliveryMode,
      recipients: normalized.recipientEmails,
      from,
      replyTo,
      validationErrors: [],
    };
  }

  async resolveOrganizationSenderFrom(organizationId: string): Promise<string | null> {
    const settings = await this.settingsRepository.findOne({ where: { organizationId } });
    const normalized = this.normalizeSettings(settings);
    if (!normalized.fromEmail || !this.isValidEmail(normalized.fromEmail)) {
      return null;
    }
    return this.composeFromHeader(normalized.fromName, normalized.fromEmail);
  }

  private sanitizePayload(data: UpdateContactEmailSettingsDto): {
    deliveryMode: ContactEmailDeliveryMode;
    recipientEmails: string[];
    fromName: string | null;
    fromEmail: string | null;
    replyToMode: ContactEmailReplyToMode;
    customReplyTo: string | null;
  } {
    return {
      deliveryMode: data.deliveryMode,
      recipientEmails: (data.recipientEmails || []).map((value) => value.trim().toLowerCase()).filter(Boolean),
      fromName: data.fromName?.trim() || null,
      fromEmail: data.fromEmail?.trim().toLowerCase() || null,
      replyToMode: data.replyToMode,
      customReplyTo: data.customReplyTo?.trim().toLowerCase() || null,
    };
  }

  private normalizeSettings(settings?: OrganizationContactEmailSettings | null): {
    deliveryMode: ContactEmailDeliveryMode;
    recipientEmails: string[];
    fromName: string | null;
    fromEmail: string | null;
    replyToMode: ContactEmailReplyToMode;
    customReplyTo: string | null;
  } {
    if (!settings) {
      return {
        deliveryMode: 'in_app_only',
        recipientEmails: [],
        fromName: null,
        fromEmail: null,
        replyToMode: 'resident_email',
        customReplyTo: null,
      };
    }

    return {
      deliveryMode: settings.deliveryMode,
      recipientEmails: (settings.recipientEmails || []).map((value) => value.trim().toLowerCase()).filter(Boolean),
      fromName: settings.fromName?.trim() || null,
      fromEmail: settings.fromEmail?.trim().toLowerCase() || null,
      replyToMode: settings.replyToMode,
      customReplyTo: settings.customReplyTo?.trim().toLowerCase() || null,
    };
  }

  private validate(settings: {
    deliveryMode: ContactEmailDeliveryMode;
    recipientEmails: string[];
    fromName: string | null;
    fromEmail: string | null;
    replyToMode: ContactEmailReplyToMode;
    customReplyTo: string | null;
  }): ContactEmailSettingsValidation {
    const errors: string[] = [];

    if (settings.deliveryMode === 'in_app_and_email') {
      if (settings.recipientEmails.length === 0) {
        errors.push('At least one recipient email is required when email delivery is enabled');
      }

      if (settings.recipientEmails.some((email) => !this.isValidEmail(email))) {
        errors.push('recipientEmails contains invalid email');
      }

      if (settings.fromEmail && !this.isValidEmail(settings.fromEmail)) {
        errors.push('fromEmail is invalid');
      }

      if (settings.replyToMode === 'custom') {
        if (!settings.customReplyTo) {
          errors.push('customReplyTo is required when replyToMode is custom');
        } else if (!this.isValidEmail(settings.customReplyTo)) {
          errors.push('customReplyTo is invalid');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private toView(
    settings: {
      deliveryMode: ContactEmailDeliveryMode;
      recipientEmails: string[];
      fromName: string | null;
      fromEmail: string | null;
      replyToMode: ContactEmailReplyToMode;
      customReplyTo: string | null;
    },
    validation: ContactEmailSettingsValidation,
  ): ContactEmailSettingsViewDto {
    return {
      deliveryMode: settings.deliveryMode,
      recipientEmails: settings.recipientEmails,
      fromName: settings.fromName,
      fromEmail: settings.fromEmail,
      replyToMode: settings.replyToMode,
      customReplyTo: settings.customReplyTo,
      canSendEmail: settings.deliveryMode === 'in_app_and_email' && validation.valid,
      validationErrors: validation.errors,
    };
  }

  private resolveReplyTo(
    replyToMode: ContactEmailReplyToMode,
    customReplyTo: string | null,
    residentEmail: string | null,
  ): string | null {
    if (replyToMode === 'custom') {
      return customReplyTo;
    }

    return residentEmail?.trim() || null;
  }

  private composeFromHeader(fromName: string | null, fromEmail: string | null): string | null {
    if (!fromEmail) {
      return null;
    }

    if (!fromName) {
      return fromEmail;
    }

    return `${fromName} <${fromEmail}>`;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
