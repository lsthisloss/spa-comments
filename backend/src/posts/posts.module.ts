import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { PostsGateway } from './posts.gateway';
import { CommentsModule } from '../comments/comments.module';
import { Post } from './entities/post.entity';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { CommonWsService } from 'src/common/common-ws.service';
import { UsersModule } from '../users/users.module';
import { UsersGateway } from 'src/users/users.gateway';
import { UsersService } from 'src/users/users.service';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { Comment } from '../comments/entities/comment.entity'; // Добавляем импорт Comment

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, User, Comment]), // Добавляем Comment в TypeOrmModule
    forwardRef(() => CommentsModule),
    RabbitMQModule,
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
  ],
  providers: [
    PostsService,
    PostsGateway,
    CommonWsService,
    UsersGateway,
    UsersService,
  ],
  exports: [UsersService, PostsService, PostsGateway],
})
export class PostsModule {}
