import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { CommentsGateway } from './comments.gateway';
import { Comment } from './entities/comment.entity';
import { AppGateway } from '../app.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Comment])],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsGateway, AppGateway],
  exports: [CommentsService],
})
export class CommentsModule {}
