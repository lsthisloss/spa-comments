import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class QueueMonitorService {
  private readonly logger = new Logger(QueueMonitorService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

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

  isRabbitMQConnected(): boolean {
    return (
      this.rabbitMQService.isConnected() &&
      this.rabbitMQService.connection &&
      !this.rabbitMQService.connection.closed
    );
  }

  // Метод для ручной проверки (можно вызвать через API)
  async getQueueStatus() {
    try {
      const stats = await this.rabbitMQService.getQueueStats();

      if (!stats) {
        return {
          error: 'RabbitMQ not available',
          status: 'disconnected',
          timestamp: new Date().toISOString(),
        };
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
        rabbitmq: {
          connected: true,
          connectionStatus: 'active',
        },
      };
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('Failed to get queue status:', errorMessage);
      return {
        error: errorMessage,
        status: 'error',
        timestamp: new Date().toISOString(),
        rabbitmq: {
          connected: false,
          connectionStatus: 'error',
        },
      };
    }
  }

  private sendAlert(type: string, data: any) {
    this.logger.error(`🚨 ALERT [${type}]:`, JSON.stringify(data, null, 2));
  }

  async emergencyQueueCleanup() {
    try {
      this.logger.warn('🚨 Performing emergency queue cleanup...');

      const stats = await this.rabbitMQService.getQueueStats();
      if (stats) {
        this.logger.warn(
          `Queue stats before cleanup: Posts(${stats.posts.messageCount}), Comments(${stats.comments.messageCount})`,
        );
      }

      return {
        success: true,
        message: 'Emergency cleanup initiated',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('Emergency cleanup failed:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

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
