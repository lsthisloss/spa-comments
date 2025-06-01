import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import * as path from 'path';
import { AuthenticatedSocketIoAdapter } from './socket-io.adapter';
import { createConnection } from 'net';

async function waitForPostgres() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const maxRetries = 60; // Увеличили до 60 попыток
  const retryDelay = 3000; // 3 секунды между попытками
  const host = process.env.DB_HOST || 'postgres';
  const port = parseInt(process.env.DB_PORT ?? '5432');

  console.log(`Waiting for PostgreSQL at ${host}:${port}...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const socket = createConnection({ host, port }, () => {
          socket.end();
          resolve(void 0);
        });

        socket.on('error', (err) => {
          reject(err);
        });

        socket.setTimeout(3000, () => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        });
      });

      console.log('✅ PostgreSQL is ready!');
      return;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.log(
        `⏳ PostgreSQL not ready (${i + 1}/${maxRetries}): ${errorMessage}`,
      );
      if (i === maxRetries - 1) {
        throw new Error(
          'Failed to connect to PostgreSQL after maximum retries',
        );
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

async function bootstrap() {
  // Ждем PostgreSQL
  await waitForPostgres();

  console.log('🚀 Starting NestJS application...');

  // ОТЛАДКА: Выводим все переменные окружения для DB
  console.log('🔍 DATABASE ENVIRONMENT DEBUG:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PORT:', process.env.DB_PORT);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'undefined');
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log(
    'DATABASE_URL:',
    process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@')
      : 'undefined',
  );

  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Static uploads with proper headers
  app.use(
    '/uploads',
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      // Security headers для файлов
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');

      // Определяем тип контента для корректного отображения
      const ext = path.extname(req.path).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        // Для изображений показываем inline
        res.setHeader('Content-Disposition', 'inline');
      } else {
        // Для остальных файлов - скачивание
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${req.path.split('/').pop()}"`,
        );
      }
      next();
    },
    express.static(path.join(__dirname, '../uploads')),
  );

  // Health check endpoint (должен быть до WebSocket adapter'а)
  app
    .getHttpAdapter()
    .get('/health', (req: express.Request, res: express.Response) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memory: process.memoryUsage(),
      });
    });

  // WebSocket JWT middleware
  app.useWebSocketAdapter(new AuthenticatedSocketIoAdapter(app));
  console.log('[SOCKET AUTH] WebSocket adapter initialized');

  // CORS configuration
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [
            process.env.FRONTEND_URL || 'http://localhost',
            /^https?:\/\/localhost(:\d+)?$/,
          ]
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Bearer',
    ],
  });

  // Graceful shutdown
  const gracefulShutdown = () => {
    console.log('Received shutdown signal, closing server gracefully...');
    app
      .close()
      .then(() => {
        console.log('Server closed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Error during server shutdown:', error);
        process.exit(1);
      });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🎉 Application is running on: http://0.0.0.0:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://0.0.0.0:${port}/health`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
