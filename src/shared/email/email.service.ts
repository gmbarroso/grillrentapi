import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export type EmailDeliveryStatus = 'not_requested' | 'pending' | 'sent' | 'failed' | 'skipped';

export interface SendEmailAttachmentInput {
  filename: string;
  content: string;
  contentType: string;
  encoding?: 'base64';
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
  from?: string;
  attachments?: SendEmailAttachmentInput[];
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
    if (!input.to.length) {
      return {
        status: 'skipped',
        providerMessageId: null,
        errorMessage: 'No recipients configured',
      };
    }

    return this.sendViaResend(input);
  }

  private async sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = (this.configService.get<string>('RESEND_API_KEY') || '').trim();
    const defaultFrom = (this.configService.get<string>('RESEND_FROM') || '').trim();
    const from = input.from?.trim() || defaultFrom;

    if (!apiKey) {
      return {
        status: 'skipped',
        providerMessageId: null,
        errorMessage: 'RESEND_API_KEY must be configured',
      };
    }

    if (!from) {
      return {
        status: 'skipped',
        providerMessageId: null,
        errorMessage: 'RESEND_FROM or input.from is required',
      };
    }

    const headers = this.buildProviderHeaders(input);

    try {
      const client = new Resend(apiKey);
      const { data, error } = await client.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: input.replyTo,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
        })),
        headers: Object.keys(headers).length ? headers : undefined,
      });

      if (error) {
        this.logger.error(`Resend email send failed: ${error.message}`);
        return {
          status: 'failed',
          providerMessageId: null,
          errorMessage: this.trimError(error.message),
        };
      }

      return {
        status: 'sent',
        providerMessageId: data?.id || null,
        errorMessage: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email provider error';
      this.logger.error(`Resend email send failed: ${message}`);
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

  private buildProviderHeaders(input: SendEmailInput): Record<string, string> {
    const headers: Record<string, string> = { ...(input.headers || {}) };
    if (input.inReplyTo?.trim()) {
      headers['In-Reply-To'] = input.inReplyTo.trim();
    }
    if (input.references?.trim()) {
      headers.References = input.references.trim();
    }
    return headers;
  }

}
