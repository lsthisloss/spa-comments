import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();

    try {
      // Получаем токен из разных источников
      const token: string | undefined =
        (typeof client.handshake.auth?.token === 'string'
          ? client.handshake.auth.token
          : undefined) ||
        (typeof client.handshake.headers?.authorization === 'string'
          ? client.handshake.headers.authorization.replace('Bearer ', '')
          : undefined) ||
        (typeof client.request.headers?.authorization === 'string'
          ? client.request.headers.authorization.replace('Bearer ', '')
          : undefined);

      if (!token) {
        console.log('No token provided in WS connection');
        return false;
      }

      // Верифицируем токен с правильной типизацией
      const payload = this.jwtService.verify<JwtPayload>(token);

      // Проверяем что payload содержит необходимые поля
      if (!payload || typeof payload !== 'object' || !payload.sub) {
        console.log('Invalid token payload');
        return false;
      }

      // ВАЖНО: Записываем данные пользователя в client.data
      client.data = {
        user: {
          id: payload.sub,
          email: payload.email,
          userName: payload.userName,
        },
      };

      console.log(`WS JWT Guard - User authenticated:`, {
        id: payload.sub,
        userName: payload.userName,
        email: payload.email,
      });

      return true;
    } catch (error) {
      console.error(
        'WS JWT verification failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return false;
    }
  }
}
