import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContactEmailDeliveryMode,
  ContactEmailReplyToMode,
  OrganizationContactEmailSettings,
} from '../entities/organization-contact-email-settings.entity';
import { ContactEmailSettingsViewDto, UpdateContactEmailSettingsDto } from '../dto/contact-email-settings.dto';
import {
  decryptOrganizationSmtpSecret,
  encryptOrganizationSmtpSecret,
} from '../../../shared/security/org-smtp-crypto.util';

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
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        password: string;
        from: string;
      };
      validationErrors: string[];
    };

@Injectable()
export class ContactEmailSettingsService {
  constructor(
    @InjectRepository(OrganizationContactEmailSettings)
    private readonly settingsRepository: Repository<OrganizationContactEmailSettings>,
    private readonly configService: ConfigService,
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
    const encryptedSecret = payload.smtpAppPasswordProvided
      ? payload.smtpAppPassword
        ? encryptOrganizationSmtpSecret(payload.smtpAppPassword, this.configService)
        : null
      : null;

    const entity = this.settingsRepository.create({
      id: existing?.id,
      organizationId,
      deliveryMode: payload.deliveryMode,
      recipientEmails: payload.recipientEmails,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail,
      replyToMode: payload.replyToMode,
      customReplyTo: payload.customReplyTo,
      smtpHost: payload.smtpHost,
      smtpPort: payload.smtpPort,
      smtpSecure: payload.smtpSecure,
      smtpUser: payload.smtpUser,
      smtpFrom: payload.smtpFrom,
      smtpAppPasswordEncrypted: payload.smtpAppPasswordProvided
        ? encryptedSecret?.encrypted ?? null
        : existing?.smtpAppPasswordEncrypted ?? null,
      smtpAppPasswordIv: payload.smtpAppPasswordProvided
        ? encryptedSecret?.iv ?? null
        : existing?.smtpAppPasswordIv ?? null,
      smtpAppPasswordAuthTag: payload.smtpAppPasswordProvided
        ? encryptedSecret?.authTag ?? null
        : existing?.smtpAppPasswordAuthTag ?? null,
      smtpAppPasswordKeyVersion: payload.smtpAppPasswordProvided
        ? encryptedSecret?.keyVersion ?? null
        : existing?.smtpAppPasswordKeyVersion ?? null,
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

    const decryptedPassword = this.decryptSecret(
      normalized.smtpAppPasswordEncrypted,
      normalized.smtpAppPasswordIv,
      normalized.smtpAppPasswordAuthTag,
      normalized.smtpAppPasswordKeyVersion,
    );
    if (!decryptedPassword) {
      return {
        shouldSend: false,
        deliveryMode: normalized.deliveryMode,
        reason: 'Organization SMTP password is not configured',
        validationErrors: ['smtpAppPassword is required when email delivery is enabled'],
      };
    }

    const from = this.composeFromHeader(normalized.fromName, normalized.smtpFrom || normalized.fromEmail);
    const replyTo = this.resolveReplyTo(normalized.replyToMode, normalized.customReplyTo, residentEmail ?? null);

    return {
      shouldSend: true,
      deliveryMode: normalized.deliveryMode,
      recipients: normalized.recipientEmails,
      from,
      replyTo,
      smtp: {
        host: normalized.smtpHost!,
        port: normalized.smtpPort!,
        secure: Boolean(normalized.smtpSecure),
        user: normalized.smtpUser!,
        password: decryptedPassword,
        from: normalized.smtpFrom!,
      },
      validationErrors: [],
    };
  }

  private sanitizePayload(data: UpdateContactEmailSettingsDto): {
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
    smtpAppPassword: string | null;
    smtpAppPasswordProvided: boolean;
  } {
    const smtpAppPasswordProvided = Object.prototype.hasOwnProperty.call(data, 'smtpAppPassword');
    return {
      deliveryMode: data.deliveryMode,
      recipientEmails: (data.recipientEmails || []).map((value) => value.trim().toLowerCase()).filter(Boolean),
      fromName: data.fromName?.trim() || null,
      fromEmail: data.fromEmail?.trim().toLowerCase() || null,
      replyToMode: data.replyToMode,
      customReplyTo: data.customReplyTo?.trim().toLowerCase() || null,
      smtpHost: data.smtpHost?.trim() || null,
      smtpPort: data.smtpPort ?? null,
      smtpSecure: data.smtpSecure ?? null,
      smtpUser: data.smtpUser?.trim() || null,
      smtpFrom: data.smtpFrom?.trim().toLowerCase() || null,
      smtpAppPassword: data.smtpAppPassword?.trim() || null,
      smtpAppPasswordProvided,
    };
  }

  private normalizeSettings(settings?: OrganizationContactEmailSettings | null): {
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
    smtpAppPasswordEncrypted: string | null;
    smtpAppPasswordIv: string | null;
    smtpAppPasswordAuthTag: string | null;
    smtpAppPasswordKeyVersion: string | null;
    hasSmtpPassword: boolean;
  } {
    if (!settings) {
      return {
        deliveryMode: 'in_app_only',
        recipientEmails: [],
        fromName: null,
        fromEmail: null,
        replyToMode: 'resident_email',
        customReplyTo: null,
        smtpHost: null,
        smtpPort: null,
        smtpSecure: null,
        smtpUser: null,
        smtpFrom: null,
        smtpAppPasswordEncrypted: null,
        smtpAppPasswordIv: null,
        smtpAppPasswordAuthTag: null,
        smtpAppPasswordKeyVersion: null,
        hasSmtpPassword: false,
      };
    }

    return {
      deliveryMode: settings.deliveryMode,
      recipientEmails: (settings.recipientEmails || []).map((value) => value.trim().toLowerCase()).filter(Boolean),
      fromName: settings.fromName?.trim() || null,
      fromEmail: settings.fromEmail?.trim().toLowerCase() || null,
      replyToMode: settings.replyToMode,
      customReplyTo: settings.customReplyTo?.trim().toLowerCase() || null,
      smtpHost: settings.smtpHost?.trim() || null,
      smtpPort: settings.smtpPort ?? null,
      smtpSecure: settings.smtpSecure ?? null,
      smtpUser: settings.smtpUser?.trim() || null,
      smtpFrom: settings.smtpFrom?.trim().toLowerCase() || null,
      smtpAppPasswordEncrypted: settings.smtpAppPasswordEncrypted || null,
      smtpAppPasswordIv: settings.smtpAppPasswordIv || null,
      smtpAppPasswordAuthTag: settings.smtpAppPasswordAuthTag || null,
      smtpAppPasswordKeyVersion: settings.smtpAppPasswordKeyVersion || null,
      hasSmtpPassword: Boolean(settings.smtpAppPasswordEncrypted && settings.smtpAppPasswordIv && settings.smtpAppPasswordAuthTag),
    };
  }

  private validate(settings: {
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

      if (!settings.smtpHost) {
        errors.push('smtpHost is required when email delivery is enabled');
      }

      if (!settings.smtpPort) {
        errors.push('smtpPort is required when email delivery is enabled');
      }

      if (settings.smtpSecure === null) {
        errors.push('smtpSecure is required when email delivery is enabled');
      }

      if (!settings.smtpUser) {
        errors.push('smtpUser is required when email delivery is enabled');
      }

      if (!settings.smtpFrom) {
        errors.push('smtpFrom is required when email delivery is enabled');
      } else if (!this.isValidEmail(settings.smtpFrom)) {
        errors.push('smtpFrom is invalid');
      }

      if (!settings.hasSmtpPassword) {
        errors.push('smtpAppPassword is required when email delivery is enabled');
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
      smtpHost: string | null;
      smtpPort: number | null;
      smtpSecure: boolean | null;
      smtpUser: string | null;
      smtpFrom: string | null;
      hasSmtpPassword: boolean;
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
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpSecure: settings.smtpSecure,
      smtpUser: settings.smtpUser,
      smtpFrom: settings.smtpFrom,
      hasSmtpPassword: settings.hasSmtpPassword,
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

  private decryptSecret(
    encryptedValue: string | null,
    ivValue: string | null,
    authTagValue: string | null,
    keyVersion: string | null,
  ): string | null {
    return decryptOrganizationSmtpSecret(
      encryptedValue,
      ivValue,
      authTagValue,
      this.configService,
      keyVersion,
    );
  }
}
