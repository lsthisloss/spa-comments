import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controoller';
import { QueueMonitorService } from './queue-monitor.service';
import { PostsConsumer } from '../rabbitmq/consumers/posts.consumer';
import { CommentsConsumer } from '../rabbitmq/consumers/comments.consumer';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { PostsModule } from '../posts/posts.module';
import { CommentsModule } from '../comments/comments.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [RabbitMQModule, PostsModule, CommentsModule, UsersModule],
  controllers: [MonitoringController],
  providers: [QueueMonitorService, PostsConsumer, CommentsConsumer],
  exports: [QueueMonitorService],
})
export class MonitoringModule {}
