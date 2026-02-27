import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { resolveJwtSecret } from '../jwt-secret.policy';
import { UserRole } from '../../../api/user/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
    });
  }

  async validate(payload: any) {
    const isValidRole = payload?.role === UserRole.ADMIN || payload?.role === UserRole.RESIDENT;
    if (!payload?.sub || !payload?.name || !payload?.exp || !isValidRole) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return { id: payload.sub, name: payload.name, role: payload.role };
  }
}
