import { Controller, Get, Post } from '@nestjs/common';
import { QueueMonitorService } from './queue-monitor.service';

@Controller('api/monitoring') // Изменил с 'monitoring' на 'api/monitoring'
export class MonitoringController {
  constructor(private readonly queueMonitorService: QueueMonitorService) {}

  @Get('queue-status')
  async getQueueStatus() {
    return await this.queueMonitorService.getQueueStatus();
  }

  @Post('emergency-cleanup')
  async emergencyCleanup() {
    return await this.queueMonitorService.emergencyQueueCleanup();
  }

  @Get('health')
  async getHealth() {
    try {
      const queueStatus = await this.queueMonitorService.getQueueStatus();

      // Проверяем подключение RabbitMQ
      const rabbitMQConnected = this.queueMonitorService.isRabbitMQConnected();

      return {
        status: 'ok',
        timestamp: new Date(),
        queues: queueStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        rabbitmq: {
          connected: rabbitMQConnected,
          connectionStatus: rabbitMQConnected ? 'connected' : 'disconnected',
        },
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3001,
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        rabbitmq: {
          connected: false,
          connectionStatus: 'error',
        },
      };
    }
  }
}
