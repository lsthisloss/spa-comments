import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { PostsGateway } from './posts.gateway';
import { CommentsModule } from '../comments/comments.module';
import { Post } from './entities/post.entity';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { Comment } from '../comments/entities/comment.entity';
import { SearchModule } from '../search/search.module';
import { CommonModule } from '../common/common.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Post, User, Comment]),
    forwardRef(() => CommentsModule),
    RabbitMQModule,
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
    SearchModule,
    CommonModule,
  ],
  providers: [PostsService, PostsGateway],
  exports: [PostsService, PostsGateway],
})
export class PostsModule {}
