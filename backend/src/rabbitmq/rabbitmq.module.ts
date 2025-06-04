import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQService } from './rabbitmq.service';
import { CommentsConsumer } from '../rabbitmq/consumers/comments.consumer';
import { CommentsModule } from '../comments/comments.module';
import { PostsConsumer } from '../rabbitmq/consumers/posts.consumer';
import { PostsModule } from '../posts/posts.module';
import { UsersModule } from '../users/users.module';
import { CommonModule } from '../common/common.module';
import { TestModule } from '../test/test.module';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, User]),
    forwardRef(() => CommentsModule),
    forwardRef(() => PostsModule),
    forwardRef(() => UsersModule),
    CommonModule,
    TestModule,
  ],
  providers: [RabbitMQService, CommentsConsumer, PostsConsumer],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
