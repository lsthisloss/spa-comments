import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    return this.usersService.validateUser(email, password);
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) return null;
    const payload = {
      sub: user.id,
      email: user.email,
      userName: user.userName,
    };
    return { token: this.jwtService.sign(payload) };
  }

  verifyToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token);
  }
}
