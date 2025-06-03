import { Controller, Get, Post, Inject } from '@nestjs/common';
import { QueueMonitorService } from './queue-monitor.service';
import { PostsConsumer } from '../rabbitmq/consumers/posts.consumer';
import { CommentsConsumer } from '../rabbitmq/consumers/comments.consumer';

@Controller('api/monitoring')
export class MonitoringController {
  constructor(
    private readonly monitoringService: QueueMonitorService,
    @Inject(PostsConsumer) private readonly postsConsumer: PostsConsumer,
    @Inject(CommentsConsumer)
    private readonly commentsConsumer: CommentsConsumer,
  ) {}

  @Get('queue-status')
  async getQueueStatus() {
    return this.monitoringService.getQueueStatus();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  @Get('buffers')
  getBufferStatus() {
    const memoryUsage = process.memoryUsage();

    return {
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
      consumers: {
        posts: this.postsConsumer.getStats(),
        comments: this.commentsConsumer.getStats(),
      },
      uptime: `${Math.round(process.uptime())}s`,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('emergency-cleanup')
  async emergencyCleanup() {
    return this.monitoringService.emergencyQueueCleanup();
  }

  @Get('stats')
  async getDetailedStats() {
    const queueStatus = await this.monitoringService.getQueueStatus();
    const memoryUsage = process.memoryUsage();

    return {
      ...queueStatus,
      consumers: {
        posts: this.postsConsumer.getStats(),
        comments: this.commentsConsumer.getStats(),
      },
      detailed_memory: {
        rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
        heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heap_used_percent: Math.round(
          (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        ),
        external_mb: Math.round(memoryUsage.external / 1024 / 1024),
        array_buffers_mb: Math.round(memoryUsage.arrayBuffers / 1024 / 1024),
      },
      uptime_hours: Math.round((process.uptime() / 3600) * 100) / 100,
    };
  }
}
