import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { AppGateway } from '../app.gateway';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@WebSocketGateway({ cors: { origin: '*' } })
export class CommentsGateway {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly appGateway: AppGateway,
  ) {
    console.log('CommentsGateway initialized');
  }
  @SubscribeMessage('fetchComments')
  async handleFetchComments(
    @MessageBody() data: { page: number; limit: number },
  ) {
    console.log(
      `Fetching comments for page ${data.page} with limit ${data.limit}`,
    );
    const [comments, total] = await this.commentsService.findAllWithPagination(
      data.page,
      data.limit,
    );
    return { comments, total };
  }
  @SubscribeMessage('fetchNestedComments')
  async handleFetchNestedComments(@MessageBody() data: { parentId: string }) {
    console.log(`Fetching nested comments for parentId: ${data.parentId}`);
    const parent = await this.commentsService.getCommentById(data.parentId);
    const children = await this.commentsService.getCommentsByParentId(
      data.parentId,
    );
    return { parent, children };
  }

  @SubscribeMessage('addComment')
  async handleAddComment(@MessageBody() createCommentDto: CreateCommentDto) {
    console.log('Received addComment event with data:', createCommentDto);
    const comment = await this.commentsService.createComment(createCommentDto);
    console.log('Comment saved and broadcasting:', comment);
    return comment;
  }
}
