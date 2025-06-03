import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from './auth/session.service';

export class AuthenticatedSocketIoAdapter extends IoAdapter {
  private sessionService: SessionService | null = null;

  constructor(private app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: any): any {
    const server: import('socket.io').Server = super.createIOServer(
      port,
      options,
    ) as import('socket.io').Server;

    // Получаем экземпляр сервиса сессий
    try {
      this.sessionService = this.app.get(SessionService, { strict: false });
    } catch (e) {
      console.error('Could not get SessionService:', e);
    }

    type AuthenticatedSocket = import('socket.io').Socket & {
      data: { user?: { id: string; userName: string } };
    };

    const authMiddleware = (
      socket: AuthenticatedSocket,
      next: (err?: Error) => void,
    ): void => {
      // Разрешаем подключение к /users без токена
      if (socket.nsp.name === '/users') {
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
        (socket.data as { user?: { id: string; userName: string } }).user = {
          id: payload.sub,
          userName: payload.userName,
        };

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
      socket.on('disconnect', () => {
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
      namespace.use(authMiddleware);
    });

    // Apply to already existing namespaces (important for /posts, /comments, etc)
    for (const nsp of server._nsps.values()) {
      nsp.use(authMiddleware);
    }

    return server;
  }
}
