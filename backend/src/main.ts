import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as path from 'path';
import { AuthenticatedSocketIoAdapter } from './socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Static uploads
  app.use(
    '/uploads',
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${req.path.split('/').pop()}"`,
      );
      next();
    },
    express.static(path.join(__dirname, '../uploads')),
  );

  // WebSocket JWT middleware
  app.useWebSocketAdapter(new AuthenticatedSocketIoAdapter(app));
  console.log('[SOCKET AUTH] WebSocket adapter initialized');

  app.enableCors();
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
