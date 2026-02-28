import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
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

  constructor(
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepository: Repository<RevokedToken>,
    private readonly configService: ConfigService,
    private readonly securityObservability: SecurityObservabilityService,
  ) {
    super();
    this.internalServiceToken = this.configService.get<string>('INTERNAL_SERVICE_TOKEN') || undefined;
    const nodeEnv = (this.configService.get<string>('NODE_ENV') || '').toLowerCase();
    this.enforceInternalServiceToken = nodeEnv === 'production' || nodeEnv === 'staging';
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

  handleRequest(err, user, info) {
    const infoMessage = info?.message;

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
    this.logger.log(`Authenticated user: ${user.name}`);
    return user;
  }
}
