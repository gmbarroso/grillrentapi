import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (process.env.NODE_ENV === 'development') {
      this.logger.warn('Token validation bypassed in development mode');
      // Mocka o usuário no ambiente de desenvolvimento
      request.user = {
        id: '5fb5a4b1-aa0f-48e6-84b7-fed8c7992b0b',
        name: 'Guilherme Barroso',
        email: 'barroso.guilherme@gmail.com',
        password: '$2b$10$0fA8HrcS/jKAfPch52EBWO/Pfns7j.B4uMvEUdiKhFCak8fFu0K2q',
        apartment: '211',
        block: 1,
        role: 'admin',
      };
      return true;
    }

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