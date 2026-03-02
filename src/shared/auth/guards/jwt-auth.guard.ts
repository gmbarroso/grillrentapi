import { Injectable, ExecutionContext, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevokedToken } from '../entities/revoked-token.entity';
import { ConfigService } from '@nestjs/config';
import { SecurityObservabilityService } from '../../security/security-observability.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly internalServiceToken?: string;
  private readonly enforceInternalServiceToken: boolean;
  private static readonly NON_ENFORCING_ENVS = new Set(['local', 'development', 'dev', 'test']);

  constructor(
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepository: Repository<RevokedToken>,
    private readonly configService: ConfigService,
    private readonly securityObservability: SecurityObservabilityService,
  ) {
    super();
    this.internalServiceToken = this.configService.get<string>('INTERNAL_SERVICE_TOKEN') || undefined;
    const rawNodeEnv = this.configService.get<string>('NODE_ENV');
    const nodeEnv = (rawNodeEnv || '').trim().toLowerCase();
    if (!nodeEnv) {
      this.logger.warn('NODE_ENV is not set; enforcing internal service token validation by default');
    }
    this.enforceInternalServiceToken = !JwtAuthGuard.NON_ENFORCING_ENVS.has(nodeEnv);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    this.logger.log(`Handling request for ${request.url}`);

    const receivedTokenHeader = request.headers['x-internal-service-token'];
    const receivedInternalToken = Array.isArray(receivedTokenHeader)
      ? receivedTokenHeader[0]
      : receivedTokenHeader;

    if (this.enforceInternalServiceToken && !this.internalServiceToken) {
      this.securityObservability.recordInternalTrustDenial(request.url);
      throw new UnauthorizedException('Internal service token is not configured');
    }

    if (this.enforceInternalServiceToken && receivedInternalToken !== this.internalServiceToken) {
      this.logger.warn('Invalid internal service token');
      this.securityObservability.recordInternalTrustDenial(request.url);
      throw new UnauthorizedException('Invalid internal service token');
    }

    const rawOrganizationHeader = request.headers['x-organization-id'];
    const organizationId = Array.isArray(rawOrganizationHeader) ? rawOrganizationHeader[0] : rawOrganizationHeader;
    const normalizedOrganizationId = typeof organizationId === 'string' ? organizationId.trim().toLowerCase() : organizationId;
    const isValidOrganizationId = typeof normalizedOrganizationId === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedOrganizationId);
    if (!organizationId || !isValidOrganizationId) {
      this.securityObservability.recordAuthFailure('invalid_token_payload', request.url);
      throw new UnauthorizedException('Invalid organization context');
    }
    request.headers['x-organization-id'] = normalizedOrganizationId;

    const token = request.headers.authorization?.split(' ')[1];
    if (!token) {
      this.logger.warn('Token not provided');
      this.securityObservability.recordAuthFailure('token_not_provided', request.url);
      throw new UnauthorizedException('Token not provided');
    }

    const isRevoked = await this.revokedTokenRepository.findOne({ where: { token } });
    if (isRevoked) {
      this.logger.warn('Token has been revoked');
      this.securityObservability.recordRevocationDenial(request.url);
      throw new UnauthorizedException('Token has been revoked');
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest(err, user, info, context) {
    const infoMessage = info?.message;
    const request = context?.switchToHttp?.().getRequest?.();
    const rawOrganizationHeader = request?.headers?.['x-organization-id'];
    const organizationHeader = Array.isArray(rawOrganizationHeader) ? rawOrganizationHeader[0] : rawOrganizationHeader;
    const normalizedOrganizationHeader = typeof organizationHeader === 'string'
      ? organizationHeader.trim().toLowerCase()
      : organizationHeader;

    if (err) {
      const errorMessage = err.message || infoMessage || 'unknown reason';
      this.logger.warn(`Unauthorized request: ${errorMessage}`);
      if (errorMessage === 'Invalid token payload') {
        this.securityObservability.recordAuthFailure('invalid_token_payload', 'passport');
        throw new UnauthorizedException('Invalid token payload');
      }
      this.securityObservability.recordAuthFailure('invalid_or_expired_token', 'passport');
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!user) {
      this.logger.warn(`Unauthorized request: ${infoMessage || 'unknown reason'}`);
      if (infoMessage === 'Invalid token payload') {
        this.securityObservability.recordAuthFailure('invalid_token_payload', 'passport');
        throw new UnauthorizedException('Invalid token payload');
      }
      this.securityObservability.recordAuthFailure('invalid_or_expired_token', 'passport');
      throw new UnauthorizedException('Invalid or expired token');
    }
    const normalizedUserOrganizationId = typeof user.organizationId === 'string'
      ? user.organizationId.trim().toLowerCase()
      : user.organizationId;
    if (normalizedOrganizationHeader !== normalizedUserOrganizationId) {
      this.securityObservability.recordAuthFailure('invalid_token_payload', request?.url || 'passport');
      throw new ForbiddenException('Organization context mismatch');
    }
    this.logger.log(`Authenticated user: ${user.name}`);
    return user;
  }
}
