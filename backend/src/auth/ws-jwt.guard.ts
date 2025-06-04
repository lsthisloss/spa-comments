import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { JwtPayload } from './jwt-payload.interface';
import { TestService } from '../test/test.service';
interface WsClientData {
  user?: {
    id: string;
    email?: string;
    userName?: string;
    role?: string;
  };
  userId?: string;
  testMode?: boolean;
  captchaVerified?: boolean;
  testDataGeneration?: boolean;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly testService: TestService,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();

    const testDataGeneration =
      client.handshake?.query?.testDataGeneration === 'true';

    if (testDataGeneration) {
      // Для генерации тестовых данных нужен валидный JWT
      const isValidJwt = this.validateJwtToken(client);

      if (isValidJwt) {
        // Добавляем флаг генерации данных
        client.data = {
          ...(client.data as Partial<WsClientData>),
          testDataGeneration: true,
          captchaVerified: true,
        } as WsClientData;

        console.log(
          `[WS-JWT] Test data generation mode for user ${(client.data as WsClientData).user?.userName}`,
        );
        return true;
      }
    }

    return this.validateJwtToken(client);
  }

  private validateJwtToken(client: Socket): boolean {
    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        console.log(`[WS-JWT] No token provided for client ${client.id}`);
        return false;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);

      if (!payload?.sub) {
        console.log(`[WS-JWT] Invalid token payload for client ${client.id}`);
        return false;
      }

      // УСТАНАВЛИВАЕМ РЕАЛЬНЫЕ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
      client.data = {
        user: {
          id: payload.sub,
          email: payload.email,
          userName: payload.userName,
          role: payload.role || 'user',
        },
        userId: payload.sub,
        testMode: false, // Всегда false для реальных пользователей
        captchaVerified: false, // Требуется CAPTCHA для обычных пользователей
      };

      console.log(
        `[WS-JWT] User authenticated: ${payload.userName} (${payload.role})`,
      );
      return true;
    } catch (error) {
      console.error(
        `[WS-JWT] Verification failed for client ${client.id}:`,
        error &&
          typeof error === 'object' &&
          error !== null &&
          'message' in error
          ? (error as { message: string }).message
          : error,
      );
      return false;
    }
  }
  private extractTokenFromSocket(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const tokenFromAuth =
      typeof auth?.token === 'string' ? auth.token : undefined;
    if (typeof tokenFromAuth === 'string') {
      return tokenFromAuth;
    }

    const headerAuth = client.handshake.headers?.authorization;
    if (typeof headerAuth === 'string' && headerAuth.startsWith('Bearer ')) {
      return headerAuth.replace('Bearer ', '');
    }

    const requestHeaderAuth = client.request.headers?.authorization;
    if (
      typeof requestHeaderAuth === 'string' &&
      requestHeaderAuth.startsWith('Bearer ')
    ) {
      return requestHeaderAuth.replace('Bearer ', '');
    }

    return null;
  }
}
