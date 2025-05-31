import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsService } from './comments.service';
import { CommentsGateway } from './comments.gateway';
import { PostsModule } from '../posts/posts.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { Comment } from './entities/comment.entity';
import { CommonWsService } from '../common/common-ws.service';
import { Post } from '../posts/entities/post.entity';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, Post, User]),
    forwardRef(() => PostsModule),
    RabbitMQModule,
    AuthModule,
    SearchModule,
  ],
  providers: [CommentsGateway, CommentsService, CommonWsService],
  exports: [CommentsGateway, CommentsService],
})
export class CommentsModule {}
