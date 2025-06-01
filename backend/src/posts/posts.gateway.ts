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
import { isUUID } from 'class-validator';
import { PostResponseDto } from './dto/post-response.dto';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/posts' })
export class PostsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private requestCooldowns = new Map<string, number>();
  private readonly COOLDOWN_MS = 1000; // 1 секунда между запросами

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

  async findPostBySlug(slug: string) {
    console.log(
      `[PostsGateway] Received request to find post by slug: ${slug}`,
    );
    return await this.postsService.getPostBySlug(slug);
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
    try {
      const page = Math.max(1, Math.min(data.page || 1, 10));
      const limit = Math.max(1, Math.min(data.limit || 25, 50));

      const result = await this.postsService.getFeedPosts(page, limit);

      return {
        ...result,
        allLoaded: result.posts.length < limit || page * limit >= result.total,
      };
    } catch (error) {
      console.error('Error fetching feed posts:', error);
      return {
        posts: [],
        total: 0,
        isEmpty: true,
        allLoaded: true,
        error: 'Failed to fetch feed posts',
      };
    }
  }

  @SubscribeMessage('fetchUserPosts')
  async handleFetchUserPosts(
    @MessageBody() data: { userId: string; page: number; limit: number },
  ) {
    try {
      let userId = data.userId;
      // Если это не UUID, ищем пользователя по слагу
      if (!isUUID(userId)) {
        const user = await this.usersService.getUserBySlug(userId);
        if (!user) {
          return {
            posts: [],
            total: 0,
            isEmpty: true,
            allLoaded: true,
            error: 'User not found',
          };
        }
        userId = user.id;
      }

      console.log(`Fetching posts for user ${userId}, page ${data.page}`);

      const page = Math.max(1, Math.min(data.page || 1, 10));
      const limit = Math.max(1, Math.min(data.limit || 25, 50));

      const posts = await this.postsService.getUserPosts(userId, page, limit);
      const total = await this.postsService.getUserPostsCount(userId);

      console.log(
        `Found ${posts.length} posts out of ${total} total for user ${userId}`,
      );

      return {
        posts,
        total,
        isEmpty: total === 0,
        allLoaded: posts.length < limit || page * limit >= total,
      };
    } catch (error: unknown) {
      let message = 'Internal server error';
      if (error instanceof Error) {
        message = error.message;
      }
      console.error('Error fetching user posts:', message);
      return {
        posts: [],
        total: 0,
        isEmpty: true,
        allLoaded: true,
        error: message,
      };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('fetchFollowingPosts')
  async handleFetchFollowingPosts(
    @MessageBody() data: { page: number; limit: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userData = client.data as { user?: { id?: string } };
      const currentUserId = userData.user?.id;

      if (!currentUserId) {
        return { error: 'User not authenticated' };
      }

      // ЗАЩИТА 1: Rate limiting per user
      const cooldownKey = `following_${currentUserId}`;
      const now = Date.now();
      const lastRequest = this.requestCooldowns.get(cooldownKey) || 0;

      if (now - lastRequest < this.COOLDOWN_MS) {
        console.log(`Rate limit hit for user ${currentUserId}`);
        return {
          posts: [],
          total: 0,
          error: 'Too many requests, please wait',
          cooldown: this.COOLDOWN_MS - (now - lastRequest),
        };
      }

      this.requestCooldowns.set(cooldownKey, now);

      // ЗАЩИТА 2: Валидация параметров
      const page = Math.max(1, Math.min(data.page || 1, 10)); // Макс 10 страниц
      const limit = Math.max(1, Math.min(data.limit || 25, 50)); // Макс 50 постов

      console.log(
        `Fetching following posts for user ${currentUserId}, page ${page}, limit ${limit}`,
      );

      const result = await this.postsService.getFollowingPosts(
        currentUserId,
        page,
        limit,
      );

      console.log(
        `Found ${result.posts.length} following posts out of ${result.total} total`,
      );

      // ЗАЩИТА 3: Специальная обработка пустых результатов
      if (result.isEmpty || (result.total === 0 && result.posts.length === 0)) {
        return {
          posts: [],
          total: 0,
          isEmpty: true,
          allLoaded: true,
          message:
            'No posts from followed users. Follow some users to see their posts here!',
        };
      }

      return {
        ...result,
        allLoaded: result.posts.length < limit || page * limit >= result.total,
      };
    } catch (error: unknown) {
      let message = 'Internal server error';
      if (error instanceof Error) {
        message = error.message;
      }
      console.error('Error fetching following posts:', message);
      return {
        error: message,
        posts: [],
        total: 0,
        isEmpty: true,
        allLoaded: true,
      };
    }
  }

  // Очистка старых записей cooldown
  @SubscribeMessage('ping')
  handlePing() {
    // Очищаем старые записи каждые 10 секунд
    const now = Date.now();
    for (const [key, timestamp] of this.requestCooldowns.entries()) {
      if (now - timestamp > 10000) {
        this.requestCooldowns.delete(key);
      }
    }
    return { pong: now };
  }

  @SubscribeMessage('fetchPost')
  async handleFetchPostWithComments(
    @MessageBody() data: { postId?: string; slug?: string },
  ) {
    console.log('[fetchPost] called with:', data);

    let post: PostResponseDto | undefined;

    // Сначала пробуем по slug, если передан
    if (data.slug) {
      post = await this.postsService.getPostBySlug(data.slug);
    }

    // Если не найден по slug или slug не передан, пробуем по ID
    if (!post && data.postId) {
      post = await this.postsService.getPostById(data.postId);
    }

    if (!post) {
      console.log('[fetchPost] post not found:', data);
      return { post: null, total: 0 };
    }

    // Update the comment count before returning the post
    await this.postsService.updateCommentCount(post.id);

    // Get the post again with updated count
    const updatedPost = data.slug
      ? await this.postsService.getPostBySlug(data.slug)
      : await this.postsService.getPostById(data.postId!);

    const result = await this.commentsService.findCommentsByParentId(
      post.id,
      1,
      1,
      'date',
    );

    const sanitizedPost = updatedPost ? { ...updatedPost } : null;

    console.log('[fetchPost] result:', {
      identifier: data.slug || data.postId,
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

  @SubscribeMessage('fetchPostBySlug')
  async handleFetchPostBySlug(@MessageBody() data: { slug: string }) {
    console.log('[fetchPostBySlug] called with:', data);

    const post = await this.postsService.getPostBySlug(data.slug);
    if (!post) {
      console.log('[fetchPostBySlug] post not found:', data.slug);
      return { post: null, total: 0 };
    }

    // Update the comment count before returning the post
    await this.postsService.updateCommentCount(post.id);

    // Get the post again with updated count
    const updatedPost = await this.postsService.getPostBySlug(data.slug);

    const result = await this.commentsService.findCommentsByParentId(
      post.id,
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

    console.log('[fetchPostBySlug] result:', {
      slug: data.slug,
      post: sanitizedPost,
      total: result.total,
    });

    return {
      post: sanitizedPost,
      total: result.total,
    };
  }
}
