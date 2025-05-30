import { Module, forwardRef } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { CommentsConsumer } from '../rabbitmq/consumers/comments.consumer';
import { CommentsModule } from '../comments/comments.module';
import { PostsConsumer } from '../rabbitmq/consumers/posts.consumer';
import { PostsModule } from '../posts/posts.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    forwardRef(() => CommentsModule),
    forwardRef(() => PostsModule),
    forwardRef(() => UsersModule),
  ],
  providers: [RabbitMQService, CommentsConsumer, PostsConsumer],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
