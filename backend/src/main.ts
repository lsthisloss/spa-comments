import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import * as path from 'path';
import { AuthenticatedSocketIoAdapter } from './socket-io.adapter';
import { createConnection } from 'net';
import { Client, ClientConfig } from 'pg';

interface ErrorLike {
  message: unknown;
}

function isErrorLike(err: unknown): err is ErrorLike {
  return err != null && typeof err === 'object' && 'message' in err;
}

function toError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  if (typeof err === 'string') {
    return new Error(err);
  }
  if (isErrorLike(err)) {
    return new Error(String(err.message));
  }
  return new Error('Unknown error occurred');
}

async function createDatabaseIfNotExists(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const dbName = process.env.DB_NAME || 'spa_comments';

  // Создаем конфигурацию с явными строковыми типами
  const host = process.env.DB_HOST || 'postgres';
  const port = parseInt(process.env.DB_PORT ?? '5432');
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  console.log(`🔧 Checking if database "${dbName}" exists...`);

  // Создаем объект конфигурации с явной типизацией
  const clientConfig = {
    host,
    port,
    user,
    password,
    database: 'postgres' as const, // Подключаемся к системной БД
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL server');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );

    if (result.rows.length === 0) {
      console.log(`📦 Creating database "${dbName}"...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created successfully!`);
    } else {
      console.log(`✅ Database "${dbName}" already exists`);
    }
  } catch (err: unknown) {
    const error = toError(err);
    console.error('❌ Error creating database:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}
async function waitForPostgres(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const maxRetries = 60;
  const retryDelay = 3000;
  const host = process.env.DB_HOST || 'postgres';
  const port = parseInt(process.env.DB_PORT ?? '5432');

  console.log(`⏳ Waiting for PostgreSQL at ${host}:${port}...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = createConnection({ host, port }, () => {
          socket.end();
          resolve();
        });

        socket.on('error', (socketErr: Error) => {
          reject(socketErr);
        });

        socket.setTimeout(3000, () => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        });
      });

      console.log('✅ PostgreSQL server is ready!');
      return;
    } catch (err: unknown) {
      const error = toError(err);
      console.log(
        `⏳ PostgreSQL not ready (${i + 1}/${maxRetries}): ${error.message}`,
      );
      if (i === maxRetries - 1) {
        throw new Error(
          'Failed to connect to PostgreSQL after maximum retries',
        );
      }
      await new Promise<void>((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

async function bootstrap(): Promise<void> {
  try {
    await waitForPostgres();
    await createDatabaseIfNotExists();

    console.log('🚀 Starting NestJS application...');

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

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.use(
      '/uploads',
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');

        const ext = path.extname(req.path).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
          res.setHeader('Content-Disposition', 'inline');
        } else {
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${req.path.split('/').pop() || 'file'}"`,
          );
        }
        next();
      },
      express.static(path.join(__dirname, '../uploads')),
    );

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

    app.useWebSocketAdapter(new AuthenticatedSocketIoAdapter(app));
    console.log('[SOCKET AUTH] WebSocket adapter initialized');

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

    const gracefulShutdown = (): void => {
      console.log('Received shutdown signal, closing server gracefully...');
      app
        .close()
        .then(() => {
          console.log('Server closed successfully');
          process.exit(0);
        })
        .catch((err: unknown) => {
          const error = toError(err);
          console.error('Error during server shutdown:', error.message);
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
  } catch (err: unknown) {
    const error = toError(err);
    console.error('❌ Failed to start application:', error.message);
    process.exit(1);
  }
}

bootstrap().catch((err: unknown) => {
  const error = toError(err);
  console.error('❌ Failed to start application:', error.message);
  process.exit(1);
});
