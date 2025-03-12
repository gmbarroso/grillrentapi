import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../api/user/entities/user.entity';
import { LoginUserDto } from '../../../api/user/dto/login-user.dto';
import { RevokedToken } from '../entities/revoked-token.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepository: Repository<RevokedToken>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(apartment: string, block: number, pass: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { apartment, block } });
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginUserDto: LoginUserDto) {
    const user = await this.validateUser(loginUserDto.apartment, loginUserDto.block, loginUserDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { name: user.name, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async logout(token: string) {
    const decodedToken = this.jwtService.decode(token) as any;
    const expirationDate = new Date(decodedToken.exp * 1000);
    const revokedToken = this.revokedTokenRepository.create({ token, expirationDate });
    await this.revokedTokenRepository.save(revokedToken);
    return { message: 'Logout successful' };
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    const revokedToken = await this.revokedTokenRepository.findOne({ where: { token } });
    return !!revokedToken;
  }
}