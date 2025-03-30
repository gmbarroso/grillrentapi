import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) {
      this.logger.warn('Authorization header missing or token not provided');
      throw new UnauthorizedException('Token missing');
    }

    // Chama o método pai para validar o token
    return (await super.canActivate(context)) as boolean;
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      this.logger.warn(`Unauthorized request: ${info?.message || err?.message}`);
      throw err || new UnauthorizedException('Invalid or missing token');
    }
    return user;
  }
}