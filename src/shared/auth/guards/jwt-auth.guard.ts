import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    this.logger.log(`Handling request for ${request.url}`);
    
    const token = request.headers.authorization?.split(' ')[1];
    if (token && await this.authService.isTokenRevoked(token)) {
      this.logger.warn('Token has been revoked');
      throw new UnauthorizedException('Token has been revoked');
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      this.logger.warn(`Unauthorized request: ${info?.message || err?.message}`);
      throw err || new UnauthorizedException();
    }
    this.logger.log(`Authenticated user: ${user.name}`);
    return user;
  }
}