import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PostsService } from './posts.service';
import { CommentsService } from '../comments/comments.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CommonWsService } from '../common/common-ws.service';
import { UsersService } from '../users/users.service';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from 'src/auth/ws-jwt.guard';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/posts' })
export class PostsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly commonWsService: CommonWsService,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly usersService: UsersService,
  ) {}

  handleConnection(client: Socket) {
    console.log(
      'Posts WS connected to:',
      client.nsp.name,
      'client:',
      client.id,
      'user:',
      (client.data as { user?: { id?: string } })?.user?.id || 'anonymous',
    );
  }

  handleDisconnect(client: Socket) {
    console.log('Posts WS disconnected:', client.id);
  }

  @SubscribeMessage('fetchPosts')
  async handleFetchPosts(@MessageBody() data: { page: number; limit: number }) {
    const { page = 1, limit = 25 } = data;
    console.log(`Fetching posts for page ${page} with limit ${limit}`);
    const { posts, total } = await this.postsService.getPostsPaginated(
      page,
      limit,
    );
    return { posts, total };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('addPost')
  async handleAddPost(
    @MessageBody() createPostDto: CreatePostDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userData = client.data as { user?: { id?: string } };
    const userId = userData.user?.id;

    if (!userId) {
      throw new WsException('Unauthorized user');
    }

    createPostDto.userId = userId;

    console.log('Creating post with data:', createPostDto);

    try {
      if (createPostDto.image && createPostDto.file) {
        console.log('Processing both image and file');
        const fileResult = this.commonWsService.processContentWithMultipleFiles(
          createPostDto.content,
          {
            image: createPostDto.image,
            file: createPostDto.file,
          },
        );

        Object.assign(createPostDto, fileResult);

        delete createPostDto.file;
        delete createPostDto.image;
      } else if (createPostDto.file) {
        console.log('Processing file only');
        const fileResult = this.commonWsService.processContentWithFile(
          createPostDto.content,
          { file: createPostDto.file },
        );

        Object.assign(createPostDto, fileResult);

        delete createPostDto.file;
      } else if (createPostDto.image) {
        console.log('Processing image only');
        const fileResult = this.commonWsService.processContentWithFile(
          createPostDto.content,
          { file: createPostDto.image },
        );

        Object.assign(createPostDto, {
          ...fileResult,
          imageUrl: fileResult.fileUrl,
        });

        delete createPostDto.image;
      }

      console.log('Final post data before queue:', createPostDto);

      await this.postsService.sendPostToQueue(createPostDto);

      return { success: true, message: 'Post sent to queue' };
    } catch (error) {
      console.error('Error processing post:', error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to process post',
      };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('fetchFeedPosts')
  async handleFetchFeedPosts(
    @MessageBody() data: { page: number; limit: number },
  ) {
    return this.postsService.getFeedPosts(data.page, data.limit);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('fetchFollowingPosts')
  async handleFetchFollowingPosts(
    @MessageBody() data: { page: number; limit: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Получаем ID текущего пользователя из токена
      const userData = client.data as { user?: { id?: string } };
      const currentUserId = userData.user?.id;

      if (!currentUserId) {
        return { error: 'User not authenticated' };
      }

      console.log(
        `Fetching following posts for user ${currentUserId}, page ${data.page}`,
      );

      const result = await this.postsService.getFollowingPosts(
        currentUserId,
        data.page,
        data.limit,
      );

      console.log(
        `Found ${result.posts.length} following posts out of ${result.total} total`,
      );

      return result;
    } catch (error: unknown) {
      let message = 'Internal server error';
      if (error instanceof Error) {
        message = error.message;
      }
      console.error('Error fetching following posts:', message);
      return { error: message };
    }
  }

  @SubscribeMessage('fetchUserPosts')
  async handleFetchUserPosts(
    @MessageBody() data: { userId: string; page: number; limit: number },
  ) {
    try {
      console.log(`Fetching posts for user ${data.userId}, page ${data.page}`);

      const posts = await this.postsService.getUserPosts(
        data.userId,
        data.page,
        data.limit,
      );

      const total = await this.postsService.getUserPostsCount(data.userId);

      console.log(
        `Found ${posts.length} posts out of ${total} total for user ${data.userId}`,
      );

      return { posts, total };
    } catch (error: unknown) {
      let message = 'Internal server error';
      if (error instanceof Error) {
        message = error.message;
      }
      console.error('Error fetching user posts:', message);
      return { error: message };
    }
  }

  @SubscribeMessage('fetchPost')
  async handleFetchPostWithComments(@MessageBody() data: { postId: string }) {
    console.log('[fetchPost] called with:', data);

    const post = await this.postsService.getPostById(data.postId);
    if (!post) {
      console.log('[fetchPost] post not found:', data.postId);
      return { post: null, total: 0 };
    }

    // Update the comment count before returning the post
    await this.postsService.updateCommentCount(data.postId);

    // Get the post again with updated count
    const updatedPost = await this.postsService.getPostById(data.postId);

    const result = await this.commentsService.findCommentsByParentId(
      data.postId,
      1,
      1,
      'date',
    );

    // Create a sanitized version of the post without the full user object
    const sanitizedPost = updatedPost
      ? {
          ...updatedPost,
        }
      : null;

    console.log('[fetchPost] result:', {
      postId: data.postId,
      post: sanitizedPost,
      total: result.total,
    });

    return {
      post: sanitizedPost,
      total: result.total,
    };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('unlikePost')
  async handleUnlikePost(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userData = client.data as { user?: { id?: string } };
    const userId = userData.user?.id;
    if (!userId) return { success: false };
    const result = await this.postsService.unlikePost(data.postId, userId);
    if (result.success) {
      this.server.emit('postUnliked', {
        postId: data.postId,
        likes: result.likes,
        userId,
      });
    }
    return result;
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('likePost')
  async handleLikePost(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userData = client.data as { user?: { id?: string } };
    const userId = userData.user?.id;
    if (!userId) return { success: false };
    const result = await this.postsService.likePost(data.postId, userId);
    if (result.success) {
      this.server.emit('postLiked', {
        postId: data.postId,
        likes: result.likes,
        userId,
      });
    }
    return result;
  }

  @SubscribeMessage('generateCaptcha')
  handleGenerateCaptcha(@ConnectedSocket() client: Socket) {
    return this.commonWsService.generateCaptcha(client);
  }

  @SubscribeMessage('validateCaptcha')
  handleValidateCaptcha(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { captcha: string },
  ) {
    return this.commonWsService.validateCaptcha(client, data);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('uploadImage')
  handleUploadImage(@MessageBody() data: { file: string; fileName: string }) {
    try {
      console.log('Uploading image:', data.fileName);
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

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('uploadFile')
  handleUploadFile(@MessageBody() data: { file: string; fileName: string }) {
    try {
      console.log('Uploading file:', data.fileName);
      const result = this.commonWsService.uploadFile(data);

      return {
        fileUrl: result.fileUrl,
      };
    } catch (error) {
      console.error('File upload error:', error);
      return { error: 'Failed to upload file' };
    }
  }
}
