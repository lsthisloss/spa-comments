import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from './auth/session.service';
import { ServerOptions, Server } from 'socket.io';
import { IncomingMessage, ServerResponse } from 'http';

interface SocketData {
  user?: { id: string; userName: string };
  testMode?: boolean;
  testDataGeneration?: boolean;
  captchaVerified?: boolean;
  _processedByMiddleware?: boolean;
}

type AuthenticatedSocket = import('socket.io').Socket & {
  data: SocketData;
};

export class AuthenticatedSocketIoAdapter extends IoAdapter {
  private sessionService: SessionService | null = null;

  constructor(private app: INestApplicationContext) {
    super(app);
    console.log('[SOCKET AUTH] WebSocket adapter initialized');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    console.log(`[SOCKET] 🔧 Creating WebSocket server`);
    console.log(`[SOCKET] 🔧 Environment: ${process.env.NODE_ENV}`);
    console.log(`[SOCKET] 🔧 Port parameter: ${port}`);

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      serveClient: false,
      connectTimeout: 45000,
      allowRequest: (
        req: IncomingMessage,
        callback: (err: Error | null, success: boolean) => void,
      ) => {
        // Разрешаем все запросы, но логируем их для отладки
        console.log(`[SOCKET] 🔄 Incoming connection request: ${req.url}`);
        callback(null, true);
      },
    }) as Server;

    console.log(`[SOCKET] ✅ WebSocket server created successfully`);

    if (!server.engine) {
      console.error(`[SOCKET] ❌ CRITICAL: Server engine is not available!`);
      return server;
    }

    try {
      console.log(`[SOCKET] 🔧 Setting up Engine.IO event listeners...`);

      server.engine.on('initial_headers', (headers, req: IncomingMessage) => {
        console.log('[SOCKET ENGINE] Initial headers for:', req.url);
      });

      server.engine.on('headers', (headers, req: IncomingMessage) => {
        console.log('[SOCKET ENGINE] Headers for:', req.url);
      });

      server.engine.on('connection_error', (err) => {
        console.error('[SOCKET ENGINE] Connection error:', err);
      });

      server.engine.on('connection', (socket: import('engine.io').Socket) => {
        console.log('[SOCKET ENGINE] ✅ Raw Engine.IO connection established');
        console.log(
          '[SOCKET ENGINE] Socket transport:',
          socket.transport?.name || 'unknown',
        );
        console.log('[SOCKET ENGINE] Socket readyState:', socket.readyState);
      });

      server.engine.on('upgrade', (socket: import('engine.io').Socket) => {
        console.log(
          '[SOCKET ENGINE] 🔄 Transport upgraded to:',
          socket.transport?.name,
        );
      });

      server.engine.on('upgradeError', (err) => {
        console.error('[SOCKET ENGINE] ❌ Upgrade error:', err);
      });

      const originalHandleRequest = server.engine.handleRequest.bind(
        server.engine,
      ) as (req: IncomingMessage, res: ServerResponse) => void;

      server.engine.handleRequest = function (req, res) {
        console.log(
          `[SOCKET ENGINE] 📨 HTTP Request: ${req.method} ${req.url}`,
        );
        console.log(`[SOCKET ENGINE] Headers:`, {
          'user-agent': req.headers['user-agent']?.substring(0, 50),
          connection: req.headers.connection,
          upgrade: req.headers.upgrade,
          origin: req.headers.origin,
        });
        return originalHandleRequest(req, res);
      };
    } catch (error) {
      console.error(`[SOCKET] ❌ Error setting up Engine.IO events:`, error);
    }

    // Get SessionService instance
    try {
      this.sessionService = this.app.get(SessionService, { strict: false });
      console.log('[SOCKET] ✅ SessionService acquired');
    } catch (e) {
      console.warn('[SOCKET] ⚠️ Could not get SessionService:', e);
    }

    // Создаем middleware только один раз
    const authMiddleware = (
      socket: AuthenticatedSocket,
      next: (err?: Error) => void,
    ): void => {
      // Проверяем был ли уже обработан этот сокет
      const data = socket.data as SocketData;
      if (data && data._processedByMiddleware) {
        return next();
      }

      // Помечаем сокет как обработанный
      socket.data = {
        ...((socket.data as SocketData) || {}),
        _processedByMiddleware: true,
      } as SocketData;

      console.log(`[SOCKET MIDDLEWARE] 🔍 NEW CONNECTION`);
      console.log(`[SOCKET MIDDLEWARE] Namespace: ${socket.nsp.name}`);
      console.log(`[SOCKET MIDDLEWARE] Socket ID: ${socket.id}`);
      console.log(
        `[SOCKET MIDDLEWARE] Transport: ${socket.conn.transport.name}`,
      );
      console.log(
        `[SOCKET MIDDLEWARE] Remote address: ${socket.conn.remoteAddress}`,
      );
      console.log(`[SOCKET MIDDLEWARE] Query params:`, socket.handshake.query);
      console.log(`[SOCKET MIDDLEWARE] Auth data:`, socket.handshake.auth);

      // Support testDataGeneration flag
      const isTestDataGeneration =
        socket.handshake.query?.testDataGeneration === 'true';

      if (isTestDataGeneration) {
        console.log(`[SOCKET] ✅ Test mode connection to ${socket.nsp.name}`);
        socket.data = {
          ...(socket.data || {}),
          testDataGeneration: isTestDataGeneration,
          captchaVerified: true,
        } as SocketData;
        return next();
      }

      // Список namespace, которые разрешены без аутентификации
      const anonymousNamespaces = [
        '/',
        '/users',
        '/posts',
        '/comments',
        '/search',
      ];

      if (anonymousNamespaces.includes(socket.nsp.name)) {
        console.log(
          `[SOCKET] ✅ Anonymous connection allowed to ${socket.nsp.name}`,
        );
        return next();
      }

      const token: unknown =
        socket.handshake.auth?.token ||
        (typeof socket.handshake.headers?.authorization === 'string'
          ? socket.handshake.headers?.authorization.split(' ')[1]
          : undefined) ||
        socket.handshake.query?.token;

      console.log('[SOCKET AUTH] token:', token ? 'provided' : 'not provided');

      if (typeof token !== 'string' || !token) {
        console.log(
          `[SOCKET AUTH] ❌ No token provided for ${socket.nsp.name}`,
        );
        return next(new Error('No token provided'));
      }

      try {
        const jwtService = this.app.get(JwtService, { strict: false });
        const payload = jwtService.verify<{ sub: string; userName: string }>(
          token,
          {},
        );
        console.log('[SOCKET AUTH] ✅ Token verified, payload:', payload);

        socket.data = {
          ...(socket.data || {}),
          user: {
            id: payload.sub,
            userName: payload.userName,
          },
        } as SocketData;

        if (this.sessionService) {
          const existingSession = this.sessionService.registerSession(
            payload.sub,
            payload.userName,
            socket,
          );

          if (existingSession) {
            console.log(
              `[SOCKET AUTH] Terminating previous session for user ${payload.userName}`,
            );
            this.sessionService.disconnectUser(
              payload.sub,
              'Ваша учетная запись была открыта на другом устройстве.',
            );
          }
        }

        next();
      } catch (e) {
        console.log('[SOCKET AUTH] ❌ Unauthorized:', e);
        next(new Error('Unauthorized'));
      }
    };

    // ВАЖНО: Применяем middleware только один раз - к основному серверу
    server.use(authMiddleware);

    // Устанавливаем предел слушателей для сервера
    if (
      typeof (server as unknown as { setMaxListeners?: (n: number) => void })
        .setMaxListeners === 'function'
    ) {
      (
        server as unknown as { setMaxListeners: (n: number) => void }
      ).setMaxListeners(20);
    }

    // Перехватываем метод создания namespace
    const createdNamespaces = new Set<string>();

    // Перехватываем метод создания namespace
    const originalOf = server.of.bind(server) as typeof server.of;
    server.of = function (
      name: string | RegExp | ((name: string, auth: any, fn: any) => void),
    ) {
      const namespaceName = typeof name === 'string' ? name : name.toString();

      console.log(`[SOCKET] 🎯 Creating namespace: ${namespaceName}`);

      const namespace = originalOf(name);

      // Проверяем, не добавляли ли мы уже обработчик для этого namespace
      if (!createdNamespaces.has(namespaceName)) {
        createdNamespaces.add(namespaceName);

        // Добавляем обработчик соединений только один раз для каждого namespace
        namespace.on('connection', (socket: AuthenticatedSocket) => {
          // Устанавливаем предел слушателей для сокета
          if (
            'setMaxListeners' in socket &&
            typeof (socket as { setMaxListeners?: (n: number) => void })
              .setMaxListeners === 'function'
          ) {
            (
              socket as { setMaxListeners: (n: number) => void }
            ).setMaxListeners(20);
          }

          console.log(
            `[SOCKET] 🔌 Client connected to ${namespace.name}: ${socket.id}`,
          );

          // Добавляем обработчик disconnect только один раз
          socket.once('disconnect', (reason) => {
            console.log(
              `[SOCKET] 🔌 Client disconnected from ${namespace.name}: ${socket.id}, reason: ${reason}`,
            );
          });
        });
      }

      return namespace;
    };

    // НЕ применяем middleware к существующим namespace
    // Это вызывает повторную обработку соединений

    // Глобальный обработчик подключений для основного namespace
    server.on('connection', (socket: AuthenticatedSocket) => {
      console.log(
        `[SOCKET] 🔌 Global connection: ${socket.id}, namespace: ${socket.nsp.name}`,
      );
    });

    console.log('[SOCKET] 🎯 Server setup complete, ready for connections');
    return server;
  }
}
