import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export type EmailDeliveryStatus = 'not_requested' | 'pending' | 'sent' | 'failed' | 'skipped';

export interface SendEmailInput {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  from?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
}

export interface SendEmailResult {
  status: EmailDeliveryStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (input.smtp) {
      return this.sendViaProvidedSmtp(input, input.smtp);
    }

    const provider = (this.configService.get<string>('EMAIL_PROVIDER') || 'gmail_smtp').trim().toLowerCase();

    if (!input.to.length) {
      return {
        status: 'skipped',
        providerMessageId: null,
        errorMessage: 'No recipients configured',
      };
    }

    if (provider !== 'gmail_smtp' && provider !== 'smtp') {
      return {
        status: 'skipped',
        providerMessageId: null,
        errorMessage: `Unsupported EMAIL_PROVIDER: ${provider}`,
      };
    }

    return this.sendViaSmtp(input);
  }

  private async sendViaSmtp(input: SendEmailInput): Promise<SendEmailResult> {
    const host = (this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com').trim();
    const port = Number(this.configService.get<string>('SMTP_PORT') || 465);
    const secureValue = (this.configService.get<string>('SMTP_SECURE') || '').trim().toLowerCase();
    const secure = secureValue ? secureValue === 'true' || secureValue === '1' : port === 465;
    const username = (this.configService.get<string>('SMTP_USER') || '').trim();
    const password = (
      this.configService.get<string>('SMTP_APP_PASSWORD')
      || this.configService.get<string>('SMTP_PASSWORD')
      || ''
    ).trim();
    const defaultFrom = (this.configService.get<string>('SMTP_FROM') || username).trim();
    const from = input.from?.trim() || defaultFrom;

    if (!username || !password) {
      return {
        status: 'skipped',
        providerMessageId: null,
        errorMessage: 'SMTP_USER/SMTP_APP_PASSWORD is not configured',
      };
    }

    if (!from) {
      return {
        status: 'skipped',
        providerMessageId: null,
        errorMessage: 'SMTP_FROM or input.from is required',
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: username,
          pass: password,
        },
      });

      const result = await transporter.sendMail({
        from,
        to: input.to.join(', '),
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: input.replyTo,
      });

      return {
        status: 'sent',
        providerMessageId: result.messageId || null,
        errorMessage: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email provider error';
      this.logger.error(`SMTP email send failed: ${message}`);
      return {
        status: 'failed',
        providerMessageId: null,
        errorMessage: this.trimError(message),
      };
    }
  }

  private async sendViaProvidedSmtp(
    input: SendEmailInput,
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
      from: string;
    },
  ): Promise<SendEmailResult> {
    if (!smtp.user || !smtp.password || !smtp.from || !smtp.host || !smtp.port) {
      return {
        status: 'skipped',
        providerMessageId: null,
        errorMessage: 'Organization SMTP configuration is incomplete',
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.password,
        },
      });

      const result = await transporter.sendMail({
        from: input.from?.trim() || smtp.from,
        to: input.to.join(', '),
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: input.replyTo,
      });

      return {
        status: 'sent',
        providerMessageId: result.messageId || null,
        errorMessage: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email provider error';
      this.logger.error(`SMTP email send failed: ${message}`);
      return {
        status: 'failed',
        providerMessageId: null,
        errorMessage: this.trimError(message),
      };
    }
  }

  private trimError(message: string): string {
    return message.length > 1024 ? message.slice(0, 1024) : message;
  }
}
