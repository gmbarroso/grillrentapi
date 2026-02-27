import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevokedToken } from '../entities/revoked-token.entity';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepository: Repository<RevokedToken>,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    this.logger.log(`Handling request for ${request.url}`);

    const token = request.headers.authorization?.split(' ')[1];
    if (!token) {
      this.logger.warn('Token not provided');
      throw new UnauthorizedException('Token not provided');
    }

    const isRevoked = await this.revokedTokenRepository.findOne({ where: { token } });
    if (isRevoked) {
      this.logger.warn('Token has been revoked');
      throw new UnauthorizedException('Token has been revoked');
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest(err, user, info) {
    if (err) {
      this.logger.warn(`Unauthorized request: ${err.message}`);
      throw err;
    }

    if (!user) {
      const infoMessage = info?.message;
      this.logger.warn(`Unauthorized request: ${infoMessage || 'unknown reason'}`);
      if (infoMessage === 'Invalid token payload') {
        throw new UnauthorizedException('Invalid token payload');
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
    this.logger.log(`Authenticated user: ${user.name}`);
    return user;
  }
}
