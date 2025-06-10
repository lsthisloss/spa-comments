import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';

//Троттлер для WebSocket соединений
@Injectable()
export class WsThrottlerGuard implements CanActivate {
  private readonly rateLimitMap = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly maxRequests = 20; // Максимум запросов для обычных пользователей
  private readonly testMaxRequests = 200; // Увеличенный лимит для тестовых клиентов
  private readonly windowMs = 60000; // Окно в 1 минуту
  constructor() {
    // Очищаем старые записи каждые 5 минут
    setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000,
    );
  }
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();

    // Проверяем, является ли это тестовым клиентом
    const isTestDataGeneration =
      client.handshake?.query?.testDataGeneration === 'true';

    // Для тестовых клиентов применяем более мягкие ограничения
    if (isTestDataGeneration) {
      console.log(
        `[WsThrottlerGuard] Test client detected, using relaxed limits`,
      );
      return this.checkRateLimit(client, this.testMaxRequests, 'test');
    }

    // Проверяем роль пользователя из данных сокета
    interface UserData {
      user?: {
        role?: string;
      };
    }
    const clientData = client.data as UserData;
    if (
      clientData?.user?.role === 'admin' ||
      clientData?.user?.role === 'superadmin'
    ) {
      console.log(
        `[WsThrottlerGuard] Admin user detected, bypassing rate limit`,
      );
      return true;
    }

    // Обычные пользователи
    return this.checkRateLimit(client, this.maxRequests, 'regular');
  }

  private checkRateLimit(
    client: Socket,
    maxRequests: number,
    clientType: string,
  ): boolean {
    // Получаем IP адрес клиента
    const ip =
      client.handshake?.address || client.conn?.remoteAddress || 'unknown';

    // Для тестовых клиентов добавляем clientId к ключу, чтобы каждый тестовый клиент имел свой лимит
    const clientId = client.handshake?.query?.clientId as string;
    const rateLimitKey =
      clientType === 'test' && clientId ? `${ip}-test-${clientId}` : ip;

    const now = Date.now();
    const clientData = this.rateLimitMap.get(rateLimitKey);

    // Если нет данных или окно сброшено
    if (!clientData || now > clientData.resetTime) {
      this.rateLimitMap.set(rateLimitKey, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    // Проверяем лимит
    if (clientData.count >= maxRequests) {
      console.warn(
        `[WsThrottlerGuard] Rate limit exceeded for ${clientType} client: ${rateLimitKey} (${clientData.count}/${maxRequests})`,
      );
      return false;
    }

    // Увеличиваем счетчик
    clientData.count++;

    // Логируем для отладки тестовых клиентов
    if (clientType === 'test') {
      console.log(
        `[WsThrottlerGuard] Test client ${rateLimitKey}: ${clientData.count}/${maxRequests} requests`,
      );
    }

    return true;
  }

  // Метод для очистки старых записей (можно вызывать периодически)
  cleanup(): void {
    const now = Date.now();
    for (const [key, data] of this.rateLimitMap.entries()) {
      if (now > data.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }
}
