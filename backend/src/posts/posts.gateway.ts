import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CommentsService } from '../comments/comments.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CommonWsService } from '../common/common-ws.service';
import { UsersService } from '../users/users.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { isUUID } from 'class-validator';
import { PostResponseDto } from './dto/post-response.dto';
import { TestService } from '../test/test.service';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/posts' })
export class PostsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PostsGateway.name);
  private requestCooldowns = new Map<string, number>();
  private readonly COOLDOWN_MS = 1000;
  private userPostCounts = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly MAX_POSTS_PER_MINUTE = 10;
  private readonly RATE_LIMIT_WINDOW = 60 * 1000;
  constructor(
    private readonly commonWsService: CommonWsService,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly usersService: UsersService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly testService: TestService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    this.logger.log('Posts WebSocket Gateway initialized');

    // Очистка rate limit кэша каждые 5 минут
    setInterval(
      () => {
        this.cleanupRateLimitCache();
      },
      5 * 60 * 1000,
    );
  }

  handleConnection(client: Socket) {
    console.log(`Posts WS connected: ${client.id}`);

    console.log(`[WS] Query params:`, client.handshake.query);
    console.log(`[WS] Client data:`, client.data);

    const clientData = client.data as {
      user?: { id?: string; role?: string };
      testDataGeneration?: boolean;
      testMode?: boolean;
      captchaVerified?: boolean;
    };

    const testDataGeneration =
      client.handshake?.query?.testDataGeneration === 'true';
    console.log(`[WS] testDataGeneration from query: ${testDataGeneration}`);
    console.log(
      `[WS] clientData.testDataGeneration: ${clientData?.testDataGeneration}`,
    );
    console.log(`[WS] userId: ${clientData?.user?.id}`);

    // Маркируем пользователя сразу при подключении
    if (
      (testDataGeneration || clientData?.testDataGeneration) &&
      clientData?.user?.id
    ) {
      // МАРКИРУЕМ ПОЛЬЗОВАТЕЛЯ КАК ТЕСТОВОГО
      this.testService.markAsTestUser(clientData.user.id);
      console.log(`[WS] MARKED TEST USER ON CONNECTION: ${clientData.user.id}`);
    }
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
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('addPost')
  async handleAddPost(
    @ConnectedSocket() client: Socket,
    @MessageBody() createPostDto: CreatePostDto,
  ): Promise<any> {
    try {
      const userData = client.data as {
        user?: {
          id?: string;
          role?: string;
        };
        testMode?: boolean;
        testDataGeneration?: boolean;
        captchaVerified?: boolean;
      };

      const userId = userData.user?.id;
      const userRole = userData.user?.role;

      const isTestDataGeneration =
        client.handshake?.query?.testDataGeneration === 'true' ||
        client.handshake?.auth?.testDataGeneration === 'true' ||
        userData?.testDataGeneration === true;

      const isAdmin = userRole === 'admin' || userRole === 'superadmin';

      console.log(
        `[ADD POST] User: ${userId} (${userRole}) | Admin: ${isAdmin} | TestDataGen: ${isTestDataGeneration}`,
      );

      if (!userId) {
        return { success: false, message: 'User not authenticated' };
      }

      // Маркируем пользователя ПЕРЕД проверками
      if (isTestDataGeneration) {
        this.testService.markAsTestUser(userId);
        console.log(`[ADD POST] ✅ MARKED TEST USER: ${userId}`);
      }

      // RATE LIMIT + CAPTCHA проверки ТОЛЬКО ДЛЯ НЕ-ТЕСТОВЫХ
      if (!isAdmin && !isTestDataGeneration) {
        const rateLimit = this.checkUserRateLimit(userId);
        if (!rateLimit.allowed) {
          return {
            success: false,
            message: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
            rateLimited: true,
            retryAfter: rateLimit.retryAfter,
          };
        }

        const captchaValid = this.commonWsService.isCaptchaVerified(client);
        if (!captchaValid) {
          return { success: false, message: 'Captcha verification required' };
        }
      }

      // Обновляем rate limit ТОЛЬКО ДЛЯ НЕ-ТЕСТОВЫХ
      if (!isAdmin && !isTestDataGeneration) {
        this.updateUserRateLimit(userId);
      }

      // ОТПРАВЛЯЕМ В ОЧЕРЕДЬ И ПОЛУЧАЕМ РЕАЛЬНЫЙ ID
      const result = await this.postsService.sendPostToQueue(createPostDto);

      console.log(`Post created for user ${userId}: ${result.postId}`);

      return {
        success: true,
        message: 'Post added successfully',
        postId: result.postId,
        queued: result.queued,
      };
    } catch (error: unknown) {
      console.error('Error adding post:', error);
      const message =
        error instanceof Error ? error.message : 'An unknown error occurred';
      return { success: false, message };
    }
  }
  private checkUserRateLimit(userId: string): {
    allowed: boolean;
    maxPosts: number;
    currentCount: number;
    retryAfter: number;
  } {
    const now = Date.now();
    const userLimit = this.userPostCounts.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Сбрасываем лимит для пользователя
      this.userPostCounts.set(userId, {
        count: 0,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });

      return {
        allowed: true,
        maxPosts: this.MAX_POSTS_PER_MINUTE,
        currentCount: 0,
        retryAfter: 0,
      };
    }

    const allowed = userLimit.count < this.MAX_POSTS_PER_MINUTE;
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);

    return {
      allowed,
      maxPosts: this.MAX_POSTS_PER_MINUTE,
      currentCount: userLimit.count,
      retryAfter,
    };
  }

  private updateUserRateLimit(userId: string): void {
    const userLimit = this.userPostCounts.get(userId);
    if (userLimit) {
      userLimit.count++;
      this.logger.log(
        `User ${userId} post count: ${userLimit.count}/${this.MAX_POSTS_PER_MINUTE}`,
      );
    }
  }
  private cleanupRateLimitCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, limit] of this.userPostCounts.entries()) {
      if (now > limit.resetTime) {
        this.userPostCounts.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned ${cleaned} expired rate limit entries`);
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
    const now = Date.now();
    for (const [key, timestamp] of this.requestCooldowns.entries()) {
      if (now - timestamp > 10000) {
        this.requestCooldowns.delete(key);
      }
    }
    return { pong: now };
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ) {
    void client.join(room);
    console.log(`[PostsGateway] Client ${client.id} joined room: ${room}`);

    client.emit('joinedRoom', { room, success: true });
    return { success: true, room };
  }

  @SubscribeMessage('joinUserRoom')
  handleJoinUserRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const room = `user:${data.userId}`;
    void client.join(room);
    console.log(`[PostsGateway] Client ${client.id} joined user room: ${room}`);

    client.emit('roomJoined', { room, userId: data.userId, success: true });
    return { success: true, room, userId: data.userId };
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
