import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { AuthModule } from './auth/auth.module';
import { AppGateway } from './app.gateway';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MonitoringModule } from './monitoring/monitoring.module';
import { TestModule } from './test/test.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';

import { User } from './users/entities/user.entity';
import { Post } from './posts/entities/post.entity';
import { Comment } from './comments/entities/comment.entity';
import { SearchModule } from './search/search.module';
import { CommonModule } from './common/common.module';
import { Stats } from 'fs';

// Добавьте простой контроллер для health check
import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}

@Module({
  imports: [
    // ServeStaticModule ПЕРВЫМ в списке для приоритета
    ServeStaticModule.forRoot({
      rootPath:
        process.env.NODE_ENV === 'production'
          ? join(__dirname, '..', 'uploads')
          : join(process.cwd(), 'uploads'), // Используем process.cwd() в development
      serveRoot: '/uploads',
      serveStaticOptions: {
        maxAge: 0, // Отключаем кеширование для разработки
        etag: false,
        index: false, // Отключаем индексные файлы
        dotfiles: 'ignore', // Игнорируем скрытые файлы
        setHeaders: (
          res: import('express').Response,
          path: string,
          stat: Stats,
        ) => {
          console.log(`📁 SERVE-STATIC serving: ${path}`);

          // CORS заголовки
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader(
            'Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept',
          );

          // Content-Type для изображений
          const ext = path.toLowerCase();
          if (ext.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
          } else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
          } else if (ext.endsWith('.gif')) {
            res.setHeader('Content-Type', 'image/gif');
          } else if (ext.endsWith('.webp')) {
            res.setHeader('Content-Type', 'image/webp');
          } else if (ext.endsWith('.txt')) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          }

          // Дополнительная информация для отладки
          const contentType = res.getHeader('Content-Type');
          console.log(
            `📁 File: ${path.split('/').pop()}, Size: ${stat.size} bytes, Content-Type: ${typeof contentType === 'string' ? contentType : Array.isArray(contentType) ? contentType.join(', ') : 'unknown'}`,
          );
        },
      },
    }),

    ConfigModule.forRoot({
      isGlobal: true,
      // load: [databaseConfig], // Закомментируем если файла нет
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'spa_comments',
      entities: [User, Post, Comment],
      synchronize: process.env.NODE_ENV !== 'production',
      logging:
        process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : false,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      connectTimeoutMS: 60000,
      extra: {
        connectionTimeoutMillis: 60000,
        idleTimeoutMillis: 60000,
      },
    }),
    TestModule,
    UsersModule,
    PostsModule,
    CommentsModule,
    AuthModule,
    SearchModule,
    CommonModule,
    MonitoringModule,
    RabbitMQModule,
  ],
  controllers: [HealthController],
  providers: [AppGateway],
})
export class AppModule {}
