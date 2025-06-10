import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PostsGateway } from '../posts/posts.gateway';
import { CommonWsService } from '../common/common-ws.service';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/ws-jwt.guard';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/comments' })
export class CommentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly commonWsService: CommonWsService,
    private readonly commentsService: CommentsService,
    private readonly postsGateway: PostsGateway,
  ) {}

  handleConnection(client: Socket) {
    console.log(
      'Comments WS connected to:',
      client.nsp.name,
      'client:',
      client.id,
    );
  }

  handleDisconnect(client: Socket) {
    console.log('Comments WS disconnected:', client.id);
  }

  /**
   * Отправка уведомления о новом комментарии
   */
  emitNewComment(comment: { postId: string; [key: string]: any }) {
    this.server.emit('newComment', {
      postId: comment.postId,
      comment,
    });
  }

  /**
   * Создание нового комментария
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('addComment')
  async handleAddComment(
    @MessageBody() createCommentDto: CreateCommentDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userData = client.data as { user?: { id?: string; role?: string } };
    const userId = userData.user?.id;
    const userRole = userData.user?.role || 'user';

    if (!userId) {
      console.error('No userId found in socket data');
      return { success: false, message: 'User not authenticated' };
    }

    // Проверка капчи только для обычных пользователей
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    // Если пользователь НЕ админ, проверяем капчу
    if (!isAdmin) {
      // Используем новый метод для проверки верификации капчи
      const captchaVerified = this.commonWsService.isCaptchaVerified(client);
      if (!captchaVerified) {
        return { success: false, message: 'CAPTCHA verification required' };
      }
    }

    // Устанавливаем ID авторизованного пользователя
    createCommentDto.userId = userId;

    console.log('Creating comment with data:', createCommentDto);

    try {
      if (createCommentDto.image && createCommentDto.file) {
        const fileResult = this.commonWsService.processContentWithMultipleFiles(
          createCommentDto.content,
          {
            image: createCommentDto.image,
            file: createCommentDto.file,
          },
        );

        void Object.assign(createCommentDto, fileResult);
        delete createCommentDto.file;
        delete createCommentDto.imageUrl;
      } else if (createCommentDto.file) {
        const fileResult = this.commonWsService.processContentWithFile(
          createCommentDto.content,
          { file: createCommentDto.file },
        );

        void Object.assign(createCommentDto, fileResult);
        delete createCommentDto.file;
      }

      console.log('Final comment data before queue:', createCommentDto);

      await this.commentsService.createComment(createCommentDto);
      return { success: true, message: 'Comment sent to queue' };
    } catch (error) {
      console.error('Error processing comment:', error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to process comment',
      };
    }
  }

  /**
   * Универсальный метод для получения комментариев
   * как для постов, так и для комментариев
   */
  @SubscribeMessage('fetchComments')
  async handleFetchComments(
    @MessageBody()
    data: {
      parentId?: string; // ID поста или комментария
      postId?: string;
      page?: number;
      limit: number;
      sort?: 'date' | 'likes';
    },
  ) {
    try {
      // Используем parentId или postId
      const parentId = data.parentId || data.postId;
      if (!parentId) {
        return { comments: [], total: 0, error: 'No parentId provided' };
      }

      console.log(
        `Fetching comments for parent ${parentId}, page ${data.page || 1}, sort: ${data.sort || 'date'}`,
      );

      const result = await this.commentsService.findCommentsByParentId(
        parentId,
        data.page || 1,
        data.limit,
        data.sort || 'date',
      );

      return result;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return { comments: [], total: 0, error: 'Failed to fetch comments' };
    }
  }

  /**
   * Получение коммент пользователя
   */
  @SubscribeMessage('fetchUserComments')
  async handleFetchUserComments(
    @MessageBody()
    data: {
      userId: string;
      page?: number;
      limit: number;
      sort?: 'date' | 'likes';
    },
  ) {
    try {
      console.log(
        `Fetching comments for user ${data.userId}, page ${data.page || 1}, sort: ${data.sort || 'date'}`,
      );

      const result = await this.commentsService.findCommentsByParentId(
        data.userId,
        data.page || 1,
        data.limit,
        data.sort || 'date',
      );

      const comments = result.comments || [];
      const total = result.total || 0;

      return {
        comments,
        total,
        page: data.page || 1,
      };
    } catch (error) {
      console.error('Error fetching user comments:', error);
      return {
        comments: [],
        total: 0,
        error: 'Failed to fetch user comments',
        page: data.page || 1,
      };
    }
  }

  /**
   * Лайк комментария
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('likeComment')
  async handleLikeComment(
    @MessageBody() data: { commentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userData = client.data as { user?: { id?: string } };
      const userId = userData.user?.id;
      if (!userId) {
        return { success: false, message: 'User not authenticated' };
      }

      const result = await this.commentsService.likeComment(
        data.commentId,
        userId,
      );
      if (result.success) {
        // Оповещаем всех клиентов
        this.server.emit('commentLiked', {
          commentId: data.commentId,
          userId: userId,
          newLikeCount: result.likeCount,
          likedUserIds: result.likedUserIds,
        });
      }

      return result;
    } catch (error) {
      console.error('Error liking comment:', error);
      return { success: false, message: 'Failed to like comment' };
    }
  }

  /**
   * Отмена лайка комментария
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('unlikeComment')
  async handleUnlikeComment(
    @MessageBody() data: { commentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userData = client.data as { user?: { id?: string } };
      const userId = userData.user?.id;
      if (!userId) {
        return { success: false, message: 'User not authenticated' };
      }

      const result = await this.commentsService.unlikeComment(
        data.commentId,
        userId,
      );

      if (result.success) {
        // Оповещаем всех клиентов
        this.server.emit('commentUnliked', {
          commentId: data.commentId,
          userId: userId,
          newLikeCount: result.likeCount,
          likedUserIds: result.likedUserIds,
        });
      }

      return result;
    } catch (error) {
      console.error('Error unliking comment:', error);
      return { success: false, message: 'Failed to unlike comment' };
    }
  }

  /**
   * Генерация капчи
   */
  @SubscribeMessage('generateCaptcha')
  handleGenerateCaptcha(@ConnectedSocket() client: Socket) {
    return this.commonWsService.generateCaptcha(client);
  }

  /**
   * Проверка капчи
   */
  @SubscribeMessage('validateCaptcha')
  handleValidateCaptcha(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { captcha: string },
  ) {
    return this.commonWsService.validateCaptcha(client, data);
  }

  /**
   * Загрузка изображения
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('uploadImage')
  handleUploadImage(@MessageBody() data: { file: string; fileName: string }) {
    try {
      console.log('Uploading image to comments:', data.fileName);
      const result = this.commonWsService.uploadFile(data);

      return {
        imageUrl: result.fileUrl,
        fileUrl: result.fileUrl,
      };
    } catch (error) {
      console.error('Image upload error:', error);
      return { error: 'Failed to upload image' };
    }
  }

  /**
   * Загрузка файла
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('uploadFile')
  handleUploadFile(@MessageBody() data: { file: string; fileName: string }) {
    try {
      console.log('Uploading file to comments:', data.fileName);
      const result = this.commonWsService.uploadFile(data);

      return {
        fileUrl: result.fileUrl,
      };
    } catch (error) {
      console.error('File upload error:', error);
      return { error: 'Failed to upload file' };
    }
  }

  @SubscribeMessage('fetchCommentBySlug')
  async handleFetchCommentBySlug(@MessageBody() data: { slug: string }) {
    try {
      console.log(`[CommentGateway] Fetching comment by slug: ${data.slug}`);

      if (!data.slug) {
        return { error: 'Slug is required' };
      }

      const comment = await this.commentsService.findCommentBySlug(data.slug);

      if (!comment) {
        console.warn(
          `[CommentGateway] Comment not found by slug: ${data.slug}`,
        );
        return { error: 'Comment not found' };
      }

      return { comment };
    } catch (error) {
      console.error(`[CommentGateway] Error fetching comment by slug:`, error);
      return { error: 'Server error' };
    }
  }

  @SubscribeMessage('fetchCommentsBySlug')
  async handleFetchCommentsBySlug(
    @MessageBody()
    data: {
      slug: string;
      page?: number;
      limit: number;
      sort?: 'date' | 'likes';
    },
  ) {
    try {
      console.log(
        `[CommentGateway] Fetching comments for post with slug: ${data.slug}`,
      );

      if (!data.slug) {
        return { comments: [], total: 0, error: 'Post slug is required' };
      }

      // Получаем пост по slug
      const postResult = await this.postsGateway.handleFetchPostBySlug({
        slug: data.slug,
      });
      const post = postResult.post;

      if (!post || !post.id) {
        console.warn(`[CommentGateway] Post not found by slug: ${data.slug}`);
        return { comments: [], total: 0, error: 'Post not found' };
      }

      // Используем ID поста для загрузки комментариев через существующий метод
      const result = await this.commentsService.findCommentsByParentId(
        post.id,
        data.page || 1,
        data.limit,
        data.sort || 'date',
      );

      return result;
    } catch (error) {
      console.error(
        `[CommentGateway] Error fetching comments by post slug:`,
        error,
      );
      return { comments: [], total: 0, error: 'Failed to fetch comments' };
    }
  }

  /**
   * Получение списка ответов на комментарий по slug комментария
   */
  @SubscribeMessage('fetchRepliesBySlug')
  async handleFetchRepliesBySlug(
    @MessageBody()
    data: {
      slug: string;
      page?: number;
      limit: number;
      sort?: 'date' | 'likes';
    },
  ) {
    try {
      console.log(
        `[CommentGateway] Fetching replies for comment with slug: ${data.slug}`,
      );

      if (!data.slug) {
        return { comments: [], total: 0, error: 'Comment slug is required' };
      }

      // Получаем комментарий по slug
      const comment = await this.commentsService.findCommentBySlug(data.slug);

      if (!comment) {
        console.warn(
          `[CommentGateway] Comment not found by slug: ${data.slug}`,
        );
        return { comments: [], total: 0, error: 'Comment not found' };
      }

      // Используем ID комментария для загрузки ответов
      const result = await this.commentsService.findCommentsByParentId(
        comment.id,
        data.page || 1,
        data.limit,
        data.sort || 'date',
      );

      return result;
    } catch (error) {
      console.error(
        `[CommentGateway] Error fetching replies by comment slug:`,
        error,
      );
      return { comments: [], total: 0, error: 'Failed to fetch comments' };
    }
  }
}
