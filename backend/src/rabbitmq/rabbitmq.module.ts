import { Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { CommentsConsumer } from '../rabbitmq/consumers/comments.consumer';
import { CommentsModule } from '../comments/comments.module';

@Module({
  imports: [CommentsModule],
  providers: [RabbitMQService, ...[CommentsConsumer]],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
