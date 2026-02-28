import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SecurityObservabilityService {
  private readonly logger = new Logger(SecurityObservabilityService.name);
  private readonly counters = {
    authFailures: 0,
    revocationDenials: 0,
    internalTrustDenials: 0,
  };

  private sanitizeLogField(value: string): string {
    return String(value || '')
      .replace(/[\r\n\t]/g, ' ')
      .slice(0, 512);
  }

  recordAuthFailure(reason: string, context: string): void {
    this.counters.authFailures += 1;
    this.logger.warn(
      JSON.stringify({
        event: 'auth_failure',
        context: this.sanitizeLogField(context),
        reason: this.sanitizeLogField(reason),
        count: this.counters.authFailures,
      }),
    );
  }

  recordRevocationDenial(context: string): void {
    this.counters.revocationDenials += 1;
    this.logger.warn(
      JSON.stringify({
        event: 'revocation_denial',
        context: this.sanitizeLogField(context),
        count: this.counters.revocationDenials,
      }),
    );
  }

  recordInternalTrustDenial(context: string): void {
    this.counters.internalTrustDenials += 1;
    this.logger.warn(
      JSON.stringify({
        event: 'internal_trust_denial',
        context: this.sanitizeLogField(context),
        count: this.counters.internalTrustDenials,
      }),
    );
  }

  getCounters() {
    return { ...this.counters };
  }
}
