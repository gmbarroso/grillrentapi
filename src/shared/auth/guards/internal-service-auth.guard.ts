import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityObservabilityService } from '../../security/security-observability.service';

@Injectable()
export class InternalServiceAuthGuard implements CanActivate {
  private readonly logger = new Logger(InternalServiceAuthGuard.name);
  private readonly internalServiceToken?: string;
  private readonly enforceInternalServiceToken: boolean;
  private static readonly NON_ENFORCING_ENVS = new Set(['local', 'development', 'dev', 'test']);

  constructor(
    private readonly configService: ConfigService,
    private readonly securityObservability: SecurityObservabilityService,
  ) {
    this.internalServiceToken = this.configService.get<string>('INTERNAL_SERVICE_TOKEN') || undefined;
    const nodeEnv = (this.configService.get<string>('NODE_ENV') || '').trim().toLowerCase();
    this.enforceInternalServiceToken = !InternalServiceAuthGuard.NON_ENFORCING_ENVS.has(nodeEnv);
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enforceInternalServiceToken) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const rawHeader = request.headers['x-internal-service-token'];
    const receivedToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!this.internalServiceToken) {
      this.securityObservability.recordInternalTrustDenial(request.url);
      throw new UnauthorizedException('Internal service token is not configured');
    }

    if (receivedToken !== this.internalServiceToken) {
      this.logger.warn('Invalid internal service token');
      this.securityObservability.recordInternalTrustDenial(request.url);
      throw new UnauthorizedException('Invalid internal service token');
    }

    return true;
  }
}
