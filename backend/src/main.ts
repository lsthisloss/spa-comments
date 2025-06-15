import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { AuthenticatedSocketIoAdapter } from './socket-io.adapter';
import { createConnection } from 'net';
import { Client, ClientConfig } from 'pg';
import { DataSource } from 'typeorm';
import { User } from './users/entities/user.entity';
import { Post } from './posts/entities/post.entity';
import { Comment } from './comments/entities/comment.entity';

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

async function runMigrations(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.log('🔄 Running database migrations...');
    try {
      const dataSource = await new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'postgres',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'spa_comments',
        entities: [User, Post, Comment],
        migrations: ['dist/migrations/*.js'],
      }).initialize();

      await dataSource.runMigrations();
      console.log('✅ Migrations completed successfully');
      await dataSource.destroy();
    } catch (err) {
      console.error('❌ Migration failed:', toError(err).message);
      throw err;
    }
  }
}

async function createDatabaseIfNotExists(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const dbName = process.env.DB_NAME || 'spa_comments';
  const clientConfig: ClientConfig = {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres',
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    ssl: false, // Explicitly disable SSL
  };

  console.log(`🔧 Checking if database "${dbName}" exists...`);

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL server');

    const result = await client.query<{ datname: string }>(
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
    await runMigrations();

    console.log('🚀 Starting NestJS application...');
    console.log('[MAIN] 🔍 About to create app...');

    const app = await NestFactory.create(AppModule, {
      logger:
        process.env.NODE_ENV === 'production'
          ? ['error', 'warn', 'log']
          : ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    console.log('[MAIN] 🔍 App created, about to install WebSocket adapter...');

    // КРИТИЧНО: Устанавливаем WebSocket адаптер СРАЗУ после создания приложения
    try {
      console.log('[MAIN] 🔧 Installing WebSocket adapter...');
      const socketAdapter = new AuthenticatedSocketIoAdapter(app);
      app.useWebSocketAdapter(socketAdapter);
      console.log('[MAIN] ✅ WebSocket adapter installed');
    } catch (adapterError) {
      console.error(
        '[MAIN] ❌ Error installing WebSocket adapter:',
        adapterError,
      );
      throw adapterError;
    }

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.use(
      (req: { method: string; url: string }, res: any, next: () => void) => {
        console.log(`[HTTP] ${req.method} ${req.url}`);
        next();
      },
    );

    // Uploads directory setup
    const uploadsPath =
      process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../uploads')
        : path.join(process.cwd(), 'uploads');

    console.log(`📁 Uploads directory: ${uploadsPath}`);
    console.log(`📁 Current working directory: ${process.cwd()}`);
    console.log(`📁 __dirname: ${__dirname}`);

    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
      console.log(`📁 Created uploads directory: ${uploadsPath}`);
    }

    try {
      const existingFiles = fs.readdirSync(uploadsPath);
      console.log(`📁 Found ${existingFiles.length} existing files in uploads`);
      if (existingFiles.length > 0) {
        console.log(`📁 Sample files: ${existingFiles.slice(0, 3).join(', ')}`);
      }
    } catch (error) {
      console.log(`📁 Could not read uploads directory: ${error}`);
    }

    // CORS configuration
    app.enableCors({
      origin:
        process.env.NODE_ENV === 'production'
          ? [
              process.env.FRONTEND_URL || 'https://sk8.pw',
              'https://sk8.pw',
              'https://www.sk8.pw',
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

    // Graceful shutdown handlers
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

    // Start listening
    await app.listen(3001, '0.0.0.0');

    console.log('🎉 Application is running on: http://localhost:3001');
    console.log('📁 Static files served from: /app/uploads -> /uploads/*');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Health check: http://localhost:3001/health');
    console.log('🔍 Monitoring: http://localhost:3001/api/monitoring/health');
    console.log(
      '📊 Queue status: http://localhost:3001/api/monitoring/queue-status',
    );

    // Добавим проверку Socket.IO
    console.log('🔌 Socket.IO endpoint: http://localhost:3001/socket.io/');
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
