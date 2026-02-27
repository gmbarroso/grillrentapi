import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SecurityObservabilityService {
  private readonly logger = new Logger(SecurityObservabilityService.name);
  private readonly counters = {
    authFailures: 0,
    revocationDenials: 0,
    internalTrustDenials: 0,
  };

  recordAuthFailure(reason: string, context: string): void {
    this.counters.authFailures += 1;
    this.logger.warn(`event=auth_failure context=${context} reason="${reason}" count=${this.counters.authFailures}`);
  }

  recordRevocationDenial(context: string): void {
    this.counters.revocationDenials += 1;
    this.logger.warn(`event=revocation_denial context=${context} count=${this.counters.revocationDenials}`);
  }

  recordInternalTrustDenial(context: string): void {
    this.counters.internalTrustDenials += 1;
    this.logger.warn(
      `event=internal_trust_denial context=${context} count=${this.counters.internalTrustDenials}`,
    );
  }

  getCounters() {
    return { ...this.counters };
  }
}
