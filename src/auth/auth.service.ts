import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user) {
      console.log('Stored hashed password:', user.password);
      console.log('Provided password:', pass);
      const isPasswordValid = await bcrypt.compare(pass, user.password);
      console.log('Password valid:', isPasswordValid);
      if (isPasswordValid) {
        const { password, ...result } = user;
        return result;
      } else {
        console.log('Invalid password');
      }
    } else {
      console.log('User not found');
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
