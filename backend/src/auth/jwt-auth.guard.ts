import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private jwtService: JwtService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Базовая проверка через AuthGuard('jwt')
    return super.canActivate(context);
  }

  // Исправляем типизацию метода handleRequest
  handleRequest<TUser = any>(err: any, user: TUser): TUser {
    if (err || !user) {
      throw err || new Error('Unauthorized');
    }
    return user;
  }
}
