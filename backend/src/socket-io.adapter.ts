import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from './auth/session.service';
import { ServerOptions, Server } from 'socket.io';
interface SocketData {
  user?: { id: string; userName: string };
  testMode?: boolean;
  testDataGeneration?: boolean;
  captchaVerified?: boolean;
}

type AuthenticatedSocket = import('socket.io').Socket & {
  data: SocketData;
};
export class AuthenticatedSocketIoAdapter extends IoAdapter {
  private sessionService: SessionService | null = null;

  constructor(private app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    }) as Server;

    console.log('[SOCKET] Creating server with WebSocket-only transport');

    // Получаем экземпляр сервиса сессий
    try {
      this.sessionService = this.app.get(SessionService, { strict: false });
    } catch (e) {
      console.error('Could not get SessionService:', e);
    }

    const authMiddleware = (
      socket: AuthenticatedSocket,
      next: (err?: Error) => void,
    ): void => {
      // Добавляем лог при новом подключении
      console.log(
        `[SOCKET] New connection to ${socket.nsp.name}, transport: ${socket.conn.transport.name}`,
      );

      // ДОБАВЛЯЕМ поддержку флага testDataGeneration
      const isTestDataGeneration =
        socket.handshake.query?.testDataGeneration === 'true';

      if (isTestDataGeneration) {
        console.log(
          `[Socket] Test mode connection to ${socket.nsp.name} (testDataGeneration: ${isTestDataGeneration})`,
        );
        // Устанавливаем флаг в данных сокета
        socket.data = {
          ...(socket.data || {}),
          testDataGeneration: isTestDataGeneration,
          captchaVerified: true,
        } as SocketData;
        return next();
      }

      // Разрешаем подключение к /users без токена
      if (socket.nsp.name === '/users') {
        console.log(
          `[SOCKET] Anonymous connection allowed to ${socket.nsp.name}`,
        );
        return next();
      }

      const token: unknown =
        socket.handshake.auth?.token ||
        (typeof socket.handshake.headers?.authorization === 'string'
          ? socket.handshake.headers?.authorization.split(' ')[1]
          : undefined) ||
        socket.handshake.query?.token;

      console.log('[SOCKET AUTH] token:', token);

      if (typeof token !== 'string' || !token) {
        console.log('[SOCKET AUTH] No token provided');
        return next(new Error('No token provided'));
      }

      try {
        const jwtService = this.app.get(JwtService, { strict: false });
        const payload = jwtService.verify<{ sub: string; userName: string }>(
          token,
          {},
        );
        console.log('[SOCKET AUTH] payload:', payload);
        socket.data = {
          ...(socket.data || {}),
          user: {
            id: payload.sub,
            userName: payload.userName,
          },
        } as SocketData;
        // Проверяем, есть ли уже активная сессия
        if (this.sessionService) {
          const existingSession = this.sessionService.registerSession(
            payload.sub,
            payload.userName,
            socket,
          );

          // Если была активная сессия, отключаем её
          if (existingSession) {
            console.log(
              `[SOCKET AUTH] Terminating previous session for user ${payload.userName}`,
            );
            this.sessionService.disconnectUser(
              payload.sub,
              'Ваша учетная запись была открыта на другом устройстве. Если это были не вы, возможно ваша учетная запись была скомпрометирована.',
            );
          }
        }

        next();
      } catch (e) {
        console.log('[SOCKET AUTH] Unauthorized:', e);
        next(new Error('Unauthorized'));
      }
    };

    // Обработчик отключения сокета
    server.on('connection', (socket: AuthenticatedSocket) => {
      console.log(
        `[SOCKET] Client connected: ${socket.id}, namespace: ${socket.nsp.name}`,
      );

      socket.on('disconnect', (reason) => {
        console.log(
          `[SOCKET] Client disconnected: ${socket.id}, reason: ${reason}`,
        );
        const data = socket.data as { user?: { id: string; userName: string } };
        if (this.sessionService && data.user?.id) {
          this.sessionService.removeSession(socket.id);
        }
      });
    });

    // Apply to root namespace
    server.use(authMiddleware);

    // Apply to all current and future namespaces
    server.on('new_namespace', (namespace) => {
      console.log(`[SOCKET] New namespace created: ${namespace.name}`);
      namespace.use(authMiddleware);
    });

    // Apply to already existing namespaces (important for /posts, /comments, etc)
    for (const nsp of server._nsps.values()) {
      console.log(
        `[SOCKET] Applying middleware to existing namespace: ${nsp.name}`,
      );
      nsp.use(authMiddleware);
    }

    return server;
  }
}
