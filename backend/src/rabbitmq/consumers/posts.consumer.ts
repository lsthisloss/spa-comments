import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq.service';
import { PostsService } from '../../posts/posts.service';
import type { CreatePostDto } from '../../posts/dto/create-post.dto';
import { PostsGateway } from '../../posts/posts.gateway';
import { UsersService } from '../../users/users.service';
import { CommonWsService } from '../../common/common-ws.service';
import { TestService } from '../../test/test.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Post } from '../../posts/entities/post.entity';
import { SearchService } from '../../search/search.service';
import { PostResponseDto } from '../../posts/dto/post-response.dto';
import type {
  PostIndexInput,
  AuthorIndexInput,
} from '../../search/types/search-result.types';

@Injectable()
export class PostsConsumer implements OnModuleInit {
  private readonly logger = new Logger(PostsConsumer.name);
  private readonly queueName = 'add_post_queue';

  private processedPostIds = new Map<string, number>();
  private userPostCounts = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly MAX_POSTS_PER_MINUTE = 10;
  private readonly TEST_USER_MAX_POSTS = 100;
  private readonly RATE_LIMIT_WINDOW = 60 * 1000;
  private readonly CACHE_TTL: number = 10 * 60 * 1000;

  private stats = {
    totalProcessed: 0,
    rateLimitedDropped: 0,
    duplicatesDropped: 0,
    errorsCount: 0,
  };

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly postsService: PostsService,
    private readonly postsGateway: PostsGateway,
    private readonly usersService: UsersService,
    private readonly commonWsService: CommonWsService,
    private readonly testService: TestService,
    private readonly searchService: SearchService,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  private cleanupCaches() {
    const now = Date.now();
    let rateLimitCleaned = 0;
    let cacheEntriesCleaned = 0;

    // Очищаем истекшие rate limits
    for (const [userId, limit] of this.userPostCounts.entries()) {
      if (now > limit.resetTime) {
        this.userPostCounts.delete(userId);
        rateLimitCleaned++;
      }
    }

    // Очищаем кеш по TTL
    for (const [messageHash, timestamp] of this.processedPostIds.entries()) {
      if (now - timestamp > this.CACHE_TTL) {
        this.processedPostIds.delete(messageHash);
        cacheEntriesCleaned++;
      }
    }

    // Дополнительная очистка если кеш все еще большой
    if (this.processedPostIds.size > 2000) {
      this.logger.warn(
        `Cache size still large after TTL cleanup: ${this.processedPostIds.size}, performing size-based cleanup...`,
      );

      // Очищаем половину самых старых записей
      const entries = Array.from(this.processedPostIds.entries()).sort(
        ([, a], [, b]) => a - b,
      ); // сортируем по timestamp

      const toDelete = entries.slice(0, Math.floor(entries.length / 2));
      toDelete.forEach(([hash]) => {
        this.processedPostIds.delete(hash);
        cacheEntriesCleaned++;
      });
    }

    // Логируем только если что-то очистили
    if (rateLimitCleaned > 0 || cacheEntriesCleaned > 0) {
      this.logger.log(
        `Cache cleanup: ${rateLimitCleaned} rate limits, ${cacheEntriesCleaned} cached entries (TTL: ${this.CACHE_TTL}ms)`,
      );
    }
  }
  // метод для более умной очистки кеша
  private smartCacheCleanup() {
    const cacheSize = this.processedPostIds.size;

    // Очищаем кеш только если он критически большой
    if (cacheSize > 10000) {
      this.logger.warn(
        `Critical cache size reached: ${cacheSize}, performing emergency cleanup`,
      );
      this.processedPostIds.clear();
      this.logger.log('Emergency cache cleanup completed');
    }
  }

  async onModuleInit() {
    try {
      await this.rabbitMQService.consume(this.queueName, (msg) => {
        void this.handleMessage(msg);
      });

      setInterval(
        () => {
          this.cleanupCaches();
        },
        10 * 60 * 1000,
      );

      // Добавляем дополнительный интервал для критической очистки
      setInterval(
        () => {
          this.smartCacheCleanup();
        },
        30 * 60 * 1000,
      ); // Каждые 30 минут проверяем критический размер

      this.logger.log(`Consumer subscribed to queue: ${this.queueName}`);
    } catch (error) {
      this.logger.error(
        `Error initializing consumer: ${(error as Error).message}`,
      );
    }
  }

  emergencyCleanup() {
    const oldCacheSize = this.processedPostIds.size;
    const oldRateLimitSize = this.userPostCounts.size;

    this.processedPostIds.clear();
    this.userPostCounts.clear();
    this.resetStats();

    this.logger.warn(
      `PostsConsumer emergency cleanup performed: cleared ${oldCacheSize} processed posts, ${oldRateLimitSize} rate limits`,
    );
  }

  private addToProcessedCache(messageHash: string): void {
    this.processedPostIds.set(messageHash, Date.now());
  }

  // метод для мониторинга состояния consumer
  getConsumerHealth() {
    return {
      isHealthy: true,
      cacheSize: this.processedPostIds.size,
      rateLimitEntries: this.userPostCounts.size,
      stats: this.stats,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  private async handleMessage(msg: any) {
    try {
      this.stats.totalProcessed++;

      if (!this.isValidMessage(msg)) {
        this.logger.error('Invalid message format');
        this.rabbitMQService.nackMessage(msg);
        return;
      }

      const content = msg.content.toString();
      const messageData = this.parseMessageContent(content);

      if (!messageData) {
        this.rabbitMQService.nackMessage(msg);
        return;
      }

      const { createPostDto, postId } = messageData;

      console.log(`[QUEUE] Processing message for post: ${postId || 'new'}`);

      // ПРОВЕРЯЕМ ТЕСТОВОГО ПОЛЬЗОВАТЕЛЯ
      const isTestUser = this.testService.isTestUserId(createPostDto.userId);

      console.log(
        `[QUEUE] User ${createPostDto.userId.substring(0, 8)}... isTestUser: ${isTestUser}`,
      );

      // RATE LIMITING ТОЛЬКО ДЛЯ ОБЫЧНЫХ ПОЛЬЗОВАТЕЛЕЙ
      if (!isTestUser && !this.checkRateLimit(createPostDto.userId)) {
        this.stats.rateLimitedDropped++;
        this.logger.warn(
          `❌ Rate limit exceeded for user ${createPostDto.userId} - POST DROPPED. Stats: ${this.stats.rateLimitedDropped} dropped total`,
        );
        this.rabbitMQService.ackMessage(msg);
        return;
      }

      if (isTestUser) {
        console.log(
          `[TEST] Processing test user post in DB: ${createPostDto.userId}`,
        );

        const processedData = { ...createPostDto };

        // Обрабатываем файлы для тестовых пользователей
        await this.processFiles(processedData);

        const messageHash = this.generateMessageHash(createPostDto);
        if (this.processedPostIds.has(messageHash)) {
          this.stats.duplicatesDropped++;
          this.logger.warn(`❌ Duplicate test post detected - POST DROPPED`);
          this.rabbitMQService.ackMessage(msg);
          return;
        }

        let post: Post | null = null;

        if (postId) {
          // Обновляем существующий пост в БД
          const hasFiles = !!(processedData.fileUrl || processedData.imageUrl);

          if (hasFiles) {
            post = await this.postsService.updatePostFiles(postId, {
              fileUrl: processedData.fileUrl,
              fileName: processedData.fileName,
              fileType: processedData.fileType,
              imageUrl: processedData.imageUrl,
            });
            console.log(`[TEST] Test post files updated in DB: ${postId}`);
          } else {
            post = await this.postRepository.findOne({
              where: { id: postId },
            });
          }
        } else {
          // Создаем новый пост в БД для тестового пользователя
          post = await this.postsService.createPost(processedData);
          console.log(`[TEST] Test post created in DB: ${post?.id}`);
        }

        if (!post) {
          console.error(`[TEST] Failed to process test post: ${postId}`);
          this.rabbitMQService.ackMessage(msg);
          return;
        }

        await this.indexPostInElasticsearch(post, createPostDto.userId, true);

        const postWithUser = await this.enrichPostWithUserData(
          post,
          createPostDto.userId,
        );

        void this.emitNewPostEvent(postWithUser);
        this.addToProcessedCache(messageHash);

        this.rabbitMQService.ackMessage(msg);
        return;
      }

      // Для обычных пользователей
      console.log(
        `[QUEUE] Processing regular user post: ${createPostDto.userId.substring(0, 8)}...`,
      );

      const processedData = { ...createPostDto };
      let hasFiles = false;

      if (createPostDto.image && createPostDto.file) {
        const fileResult =
          await this.commonWsService.processContentWithMultipleFiles(
            createPostDto.content,
            {
              image: createPostDto.image,
              file: createPostDto.file,
            },
          );

        Object.assign(processedData, fileResult);
        delete processedData.image;
        delete processedData.file;
        hasFiles = !!(fileResult?.fileUrl || fileResult?.imageUrl);
      } else if (createPostDto.file) {
        const fileResult = await this.commonWsService.processContentWithFile(
          createPostDto.content,
          { file: createPostDto.file },
        );

        Object.assign(processedData, fileResult);
        delete processedData.file;
        hasFiles = !!fileResult?.fileUrl;
      } else if (createPostDto.image) {
        const fileResult = await this.commonWsService.processContentWithFile(
          createPostDto.content,
          { file: createPostDto.image },
        );

        Object.assign(processedData, fileResult);
        delete processedData.image;
        hasFiles = !!fileResult?.imageUrl;
      }

      let post: Post | null = null;

      if (postId) {
        if (hasFiles) {
          const existingPost = await this.postRepository.findOne({
            where: { id: postId },
          });

          if (!existingPost) {
            console.error(`[QUEUE] Post ${postId} not found for file update`);
            this.rabbitMQService.ackMessage(msg);
            return;
          }

          post = await this.postsService.updatePostFiles(postId, {
            fileUrl: processedData.fileUrl,
            fileName: processedData.fileName,
            fileType: processedData.fileType,
            imageUrl: processedData.imageUrl,
          });
          console.log(`[QUEUE] Post files updated: ${postId}`);
        } else {
          post = await this.postRepository.findOne({
            where: { id: postId },
          });
          console.log(`[QUEUE] Post found: ${postId}`);
        }
      } else {
        const messageHash = this.generateMessageHash(createPostDto);
        if (this.processedPostIds.has(messageHash)) {
          this.stats.duplicatesDropped++;
          this.logger.warn(
            `❌ Duplicate post detected: ${messageHash} - POST DROPPED`,
          );
          this.rabbitMQService.ackMessage(msg);
          return;
        }

        post = await this.postsService.createPost(processedData);
        console.log(`[QUEUE] New post created: ${post?.id}`);
        this.addToProcessedCache(messageHash);
      }

      if (!post) {
        console.error(`[QUEUE] Failed to process post: ${postId}`);
        this.rabbitMQService.ackMessage(msg);
        return;
      }

      await this.indexPostInElasticsearch(post, createPostDto.userId, false);

      this.logger.log(
        `Post processed successfully: ${post.id} for user ${createPostDto.userId}`,
      );

      const postWithUser = await this.enrichPostWithUserData(
        post,
        createPostDto.userId,
      );

      void this.emitNewPostEvent(postWithUser);
      this.updateRateLimit(createPostDto.userId);

      this.rabbitMQService.ackMessage(msg);
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error('❌ Error processing post:', error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        errorMessage.includes('duplicate key') ||
        errorMessage.includes('unique constraint')
      ) {
        console.log('[QUEUE] Rejecting duplicate message');
        this.rabbitMQService.ackMessage(msg);
      } else {
        this.rabbitMQService.nackMessage(msg);
      }
    }
  }

  // для индексации постов в Elasticsearch
  private async indexPostInElasticsearch(
    post: Post,
    userId: string,
    isTestUser: boolean,
  ): Promise<void> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        console.warn(`❌ User ${userId} not found for post indexing`);
        return;
      }

      const authorData: AuthorIndexInput = {
        id: user.id,
        userName: user.userName,
        avatarUrl: user.avatarUrl,
        avatarShape: user.avatarShape,
        slug: user.slug,
        email: user.email,
        role: isTestUser ? 'test' : user.role,
      };

      const postIndexData: PostIndexInput = {
        id: post.id,
        content: post.content,
        slug: post.slug,
        likes: post.likes || 0,
        repliesCount: post.repliesCount || 0,
        imageUrl: post.imageUrl,
        fileUrl: post.fileUrl,
        fileName: post.fileName,
        fileType: post.fileType,
        userId: post.userId,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      };

      await this.searchService.indexPost(postIndexData, authorData);
      console.log(
        `✅ Post ${post.id} indexed in Elasticsearch (isTestUser: ${isTestUser})`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to index post ${post.id} in Elasticsearch:`,
        error,
      );
    }
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.userPostCounts.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      this.userPostCounts.set(userId, {
        count: 0,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return true;
    }

    return userLimit.count < this.MAX_POSTS_PER_MINUTE;
  }

  private async enrichPostWithUserData<T extends Post>(
    post: T,
    userId: string,
  ): Promise<PostResponseDto> {
    try {
      const isTestUser = this.testService.isTestUserId(userId);
      const user = await this.usersService.findById(userId);

      if (!user) {
        console.warn(`❌ User ${userId} not found`);
        return {
          id: post.id,
          userId: post.userId,
          userName: 'Unknown',
          content: post.content,
          createdAt: post.createdAt,
          imageUrl: post.imageUrl,
          fileUrl: post.fileUrl,
          fileName: post.fileName,
          fileType: post.fileType,
          likes: post.likes,
          likedUserIds: post.likedUserIds,
          repliesCount: post.repliesCount,
          slug: post.slug,
          user: {
            id: userId,
            userName: 'Unknown',
            avatarUrl: undefined,
            avatarShape: 'circle',
            role: isTestUser ? 'test' : 'user',
          },
        };
      }

      return {
        id: post.id,
        userId: post.userId,
        userName: user.userName,
        content: post.content,
        createdAt: post.createdAt,
        imageUrl: post.imageUrl,
        fileUrl: post.fileUrl,
        fileName: post.fileName,
        fileType: post.fileType,
        likes: post.likes,
        likedUserIds: post.likedUserIds,
        repliesCount: post.repliesCount,
        slug: post.slug,
        user: {
          id: userId,
          userName: user.userName,
          avatarUrl: user.avatarUrl,
          avatarShape: user.avatarShape,
          slug: user.slug,
          role: isTestUser ? 'test' : user.role,
        },
      };
    } catch (error) {
      this.logger.warn(`Failed to get user data for ${userId}:`, error);
      return {
        id: post.id,
        userId: post.userId,
        userName: 'Anonymous',
        content: post.content,
        createdAt: post.createdAt,
        imageUrl: post.imageUrl,
        fileUrl: post.fileUrl,
        fileName: post.fileName,
        fileType: post.fileType,
        likes: post.likes,
        likedUserIds: post.likedUserIds,
        repliesCount: post.repliesCount,
        slug: post.slug,
        user: {
          id: userId,
          userName: 'Anonymous',
          avatarUrl: undefined,
          avatarShape: 'circle',
          role: 'user',
        },
      };
    }
  }

  private async processFiles(
    processedData: Partial<CreatePostDto>,
  ): Promise<void> {
    if (processedData.image && processedData.file) {
      const fileResult =
        await this.commonWsService.processContentWithMultipleFiles(
          processedData.content as string,
          {
            image: processedData.image,
            file: processedData.file,
          },
        );
      Object.assign(processedData, fileResult);
      delete processedData.image;
      delete processedData.file;
    } else if (processedData.file) {
      const fileResult = await this.commonWsService.processContentWithFile(
        processedData.content as string,
        { file: processedData.file },
      );
      Object.assign(processedData, fileResult);
      delete processedData.file;
    } else if (processedData.image) {
      const fileResult = await this.commonWsService.processContentWithFile(
        processedData.content as string,
        { file: processedData.image },
      );
      Object.assign(processedData, fileResult);
      delete processedData.image;
    }
  }

  private updateRateLimit(userId: string): void {
    const userLimit = this.userPostCounts.get(userId);
    if (userLimit) {
      userLimit.count++;
    }
  }

  private async emitNewPostEvent(postWithUser: PostResponseDto) {
    try {
      if (this.postsGateway.server) {
        // Отправляем в общую ленту всем
        this.postsGateway.server.emit('newPost', postWithUser);
        console.log(`[EMIT] Sent newPost to ALL clients`);

        if (postWithUser.userId) {
          const room = `user:${postWithUser.userId}`;

          // Проверяем кто в room
          const socketsInRoom = await this.postsGateway.server
            .in(room)
            .fetchSockets();
          console.log(
            `[EMIT] Clients in room ${room}: ${socketsInRoom.length}`,
          );

          if (socketsInRoom.length === 0) {
            console.warn(
              `[EMIT] ⚠️ No clients in room ${room}! Event will not be delivered.`,
            );
          }

          // Отправляем в room
          this.postsGateway.server
            .to(room)
            .emit('newFollowingPost', postWithUser);

          console.log(
            `[EMIT] Sent newFollowingPost to room ${room} (${socketsInRoom.length} clients)`,
          );

          // Получаем подписчиков
          const followers = await this.getFollowers(postWithUser.userId);
          followers.forEach((followerId) => {
            const followerRoom = `user:${followerId}`;
            this.postsGateway.server
              .to(followerRoom)
              .emit('newFollowingPost', postWithUser);
          });

          this.logger.log(
            `[EMIT] Sent newFollowingPost to ${followers.length + 1} users (author + followers)`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to emit new post event:', error);
    }
  }

  //  вспомогательный метод
  private async getFollowers(userId: string): Promise<string[]> {
    try {
      // Получаем подписчиков из UsersService
      const followers = await this.usersService.getFollowers(userId);
      return followers.map((f) => f.id);
    } catch (error) {
      this.logger.error('Failed to get followers:', error);
      return [];
    }
  }

  getDetailedStats() {
    const now = Date.now();
    const activeRateLimits = Array.from(this.userPostCounts.entries())
      .filter(([, limit]) => now <= limit.resetTime)
      .map(([userId, limit]) => {
        const isTestUser = this.testService.isTestUserId(userId);
        const maxPosts = isTestUser
          ? this.TEST_USER_MAX_POSTS
          : this.MAX_POSTS_PER_MINUTE;

        return {
          userId,
          count: limit.count,
          remaining: maxPosts - limit.count,
          resetIn: Math.ceil((limit.resetTime - now) / 1000),
          isTestUser,
        };
      });

    return {
      ...this.getStats(),
      activeRateLimits,
      rateLimitSummary: {
        usersWithLimits: activeRateLimits.length,
        totalDropped: this.stats.rateLimitedDropped,
        cacheTTL: this.CACHE_TTL,
        maxPostsPerMinute: this.MAX_POSTS_PER_MINUTE,
        testUserMaxPosts: this.TEST_USER_MAX_POSTS,
      },
    };
  }

  getStats() {
    return {
      ...this.stats,
      processedCacheSize: this.processedPostIds.size,
      rateLimitEntries: this.userPostCounts.size,
      maxPostsPerMinute: this.MAX_POSTS_PER_MINUTE,
      testUserMaxPosts: this.TEST_USER_MAX_POSTS,
      timestamp: new Date().toISOString(),
    };
  }

  resetStats() {
    this.stats = {
      totalProcessed: 0,
      rateLimitedDropped: 0,
      duplicatesDropped: 0,
      errorsCount: 0,
    };
    this.logger.log('PostsConsumer stats reset');
  }

  getProcessedCacheSize(): number {
    return this.processedPostIds.size;
  }

  getRateLimitEntries(): number {
    return this.userPostCounts.size;
  }

  private isValidMessage(
    msg: unknown,
  ): msg is { content: { toString: () => string } } {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      'content' in msg &&
      typeof (msg as { content?: unknown }).content === 'object' &&
      msg.content !== null &&
      typeof (msg as { content: { toString?: unknown } }).content.toString ===
        'function'
    );
  }

  private parseMessageContent(
    content: string,
  ): { createPostDto: CreatePostDto; postId?: string } | null {
    try {
      const parsed = JSON.parse(content) as unknown;

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'createPostDto' in parsed &&
        typeof (parsed as { createPostDto?: unknown }).createPostDto ===
          'object' &&
        (parsed as { createPostDto?: unknown }).createPostDto !== null
      ) {
        const data = parsed as {
          createPostDto: Partial<CreatePostDto>;
          postId?: string;
        };
        const dto = data.createPostDto;

        if (typeof dto.userId === 'string' && typeof dto.content === 'string') {
          return {
            createPostDto: dto as CreatePostDto,
            postId: data.postId,
          };
        }
      }

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'userId' in parsed &&
        'content' in parsed &&
        typeof (parsed as { userId?: unknown }).userId === 'string' &&
        typeof (parsed as { content?: unknown }).content === 'string'
      ) {
        return {
          createPostDto: parsed as CreatePostDto,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private generateMessageHash(createPostDto: CreatePostDto): string {
    const timeWindow = Math.floor(Date.now() / 10000); // окно до 10 секунд
    const contentHash = createPostDto.content.substring(0, 50);
    const randomSalt = Math.random().toString(36).substring(2, 6); //  случайную соль
    return `${createPostDto.userId}-${timeWindow}-${contentHash}-${randomSalt}`;
  }
}
