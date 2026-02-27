import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor() {
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
