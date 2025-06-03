import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class QueueMonitorService {
  private readonly logger = new Logger(QueueMonitorService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkQueueHealth() {
    try {
      const stats = await this.rabbitMQService.getQueueStats();

      if (!stats) return;

      const totalMessages =
        stats.posts.messageCount + stats.comments.messageCount;

      // Логируем только при превышении порогов
      if (totalMessages > 1000) {
        this.logger.warn(
          `High queue load: Posts(${stats.posts.messageCount}) + Comments(${stats.comments.messageCount}) = ${totalMessages} messages`,
        );
      }

      // Критический уровень - больше 3000 сообщений
      if (totalMessages > 3000) {
        this.logger.error(
          `CRITICAL: Queue overload detected! Total messages: ${totalMessages}`,
        );

        // Здесь можно добавить алерты в Slack/Email
        this.sendAlert('QUEUE_OVERLOAD', {
          totalMessages,
          posts: stats.posts.messageCount,
          comments: stats.comments.messageCount,
          memoryUsage: process.memoryUsage(),
        });
      }
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('Queue monitoring failed:', errorMessage);
    }
  }

  // Метод для ручной проверки (можно вызвать через API)
  async getQueueStatus() {
    try {
      const stats = await this.rabbitMQService.getQueueStats();

      if (!stats) {
        return { error: 'RabbitMQ not available' };
      }

      const totalMessages =
        stats.posts.messageCount + stats.comments.messageCount;

      return {
        totalMessages,
        queues: {
          posts: stats.posts,
          comments: stats.comments,
        },
        status:
          totalMessages > 3000
            ? 'critical'
            : totalMessages > 1000
              ? 'warning'
              : 'ok',
        timestamp: stats.timestamp,
        memoryUsage: process.memoryUsage(),
      };
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('Failed to get queue status:', errorMessage);
      return { error: errorMessage };
    }
  }

  private sendAlert(type: string, data: any) {
    // Отправка алертов
    this.logger.error(`🚨 ALERT [${type}]:`, JSON.stringify(data, null, 2));
  }

  // Дополнительный метод для экстренной очистки очередей
  async emergencyQueueCleanup() {
    try {
      this.logger.warn('🚨 Performing emergency queue cleanup...');

      // Здесь можно добавить логику очистки критически переполненных очередей
      // Например, удаление старых сообщений или временное отключение некритичных операций

      const stats = await this.rabbitMQService.getQueueStats();
      if (stats) {
        this.logger.warn(
          `Queue stats before cleanup: Posts(${stats.posts.messageCount}), Comments(${stats.comments.messageCount})`,
        );
      }

      return { success: true, message: 'Emergency cleanup initiated' };
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('Emergency cleanup failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  // Утилитарный метод для безопасного извлечения сообщения об ошибке
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Unknown error occurred';
  }
}
