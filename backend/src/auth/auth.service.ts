import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserBasicDto } from '../users/dto/user-basic.dto';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserBasicDto | null> {
    const userResult = await this.usersService.validateUser(email, password);

    if (!userResult || typeof userResult !== 'object') {
      return null;
    }

    // Проверяем наличие обязательных полей
    if (!userResult.id || !userResult.email || !userResult.userName) {
      console.error('User object missing required fields:', userResult);
      return null;
    }

    // Преобразуем к UserBasicDto
    const user = new UserBasicDto();
    user.id = String(userResult.id);
    user.email = String(userResult.email);
    user.userName = String(userResult.userName);
    user.role = userResult.role ? String(userResult.role) : undefined;
    user.avatarUrl = userResult.avatarUrl
      ? String(userResult.avatarUrl)
      : undefined;
    user.avatarShape = userResult.avatarShape
      ? String(userResult.avatarShape)
      : undefined;
    user.slug = userResult.slug ? String(userResult.slug) : undefined;

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) return null;

    const role: string = user.role ?? 'user';

    const payload: JwtPayload = {
      sub: user.id!,
      email: user.email!,
      userName: user.userName!,
      role: role,
    };

    console.log(
      `Creating JWT token with role: ${role} for user: ${user.userName}`,
    );
    return { token: this.jwtService.sign(payload) };
  }

  verifyToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token);
  }
}
