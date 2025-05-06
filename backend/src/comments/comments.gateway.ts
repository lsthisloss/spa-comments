import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { AppGateway } from '../app.gateway';
import { Socket } from 'socket.io';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import * as svgCaptcha from 'svg-captcha';
import * as path from 'path';
import * as fs from 'fs';

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
    const [comments, total] = await this.commentsService.findTopLevelComments(
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
    if (
      createCommentDto.file &&
      createCommentDto.file.base64 &&
      createCommentDto.file.name
    ) {
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const fileName = `${Date.now()}-${createCommentDto.file.name}`;
      const filePath = path.join(uploadDir, fileName);
      const buffer = Buffer.from(createCommentDto.file.base64, 'base64');
      if (buffer.length > 100 * 1024) {
        return { success: false, message: 'File size must not exceed 100KB.' };
      }
      fs.writeFileSync(filePath, buffer);

      createCommentDto.fileUrl = `/uploads/${fileName}`;
      createCommentDto.fileName = createCommentDto.file.name;
      createCommentDto.fileType = createCommentDto.file.type;
      delete createCommentDto.file;
    }

    await this.commentsService.sendCommentToQueue(createCommentDto);
    return { success: true };
  }

  private captchas = new Map<string, string>();

  @SubscribeMessage('generateCaptcha')
  handleGenerateCaptcha(@ConnectedSocket() client: Socket) {
    const captcha = svgCaptcha.create({
      size: 6,
      noise: 3,
      color: true,
      background: '#f4f4f4',
    });

    this.captchas.set(client.id, captcha.text);
    console.log(`Generated CAPTCHA for client ${client.id}: ${captcha.text}`);

    return { image: captcha.data };
  }

  @SubscribeMessage('validateCaptcha')
  handleValidateCaptcha(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { captcha: string },
  ) {
    const storedCaptcha = this.captchas.get(client.id);
    if (storedCaptcha && storedCaptcha === data.captcha) {
      console.log(`CAPTCHA validated for client ${client.id}`);
      this.captchas.delete(client.id);
      return { valid: true };
    }
    console.log(`CAPTCHA validation failed for client ${client.id}`);
    return { valid: false };
  }

  @SubscribeMessage('uploadImage')
  handleImageUpload(
    @MessageBody() data: { file: string; fileName: string },
    //@ConnectedSocket() client: Socket,
  ) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${data.fileName}`;
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(data.file, 'base64');
    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/uploads/${fileName}`;
    return { imageUrl };
  }
  @SubscribeMessage('likeComment')
  async handleLikeComment(@MessageBody() data: { commentId: string }) {
    const comment = await this.commentsService.getCommentById(data.commentId);
    if (comment) {
      comment.likes = (comment.likes || 0) + 1;
      await this.commentsService.saveComment(comment);
      this.appGateway.broadcastEvent('commentLiked', {
        commentId: comment.id,
        likes: comment.likes,
      });
      return { success: true, likes: comment.likes };
    }
    return { success: false };
  }
  @SubscribeMessage('unlikeComment')
  async handleUnlikeComment(@MessageBody() data: { commentId: string }) {
    const comment = await this.commentsService.getCommentById(data.commentId);
    if (comment && comment.likes > 0) {
      comment.likes -= 1;
      await this.commentsService.saveComment(comment);
      this.appGateway.broadcastEvent('commentLiked', {
        commentId: comment.id,
        likes: comment.likes,
      });
      return { success: true, likes: comment.likes };
    }
    return { success: false };
  }
}
