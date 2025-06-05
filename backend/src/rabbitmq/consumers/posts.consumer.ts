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
import type {
  PostIndexInput,
  AuthorIndexInput,
} from '../../search/types/search-result.types';

@Injectable()
export class PostsConsumer implements OnModuleInit {
  private readonly logger = new Logger(PostsConsumer.name);
  private readonly queueName = 'add_post_queue';

  private processedPostIds = new Set<string>();
  private userPostCounts = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly MAX_POSTS_PER_MINUTE = 10;
  private readonly TEST_USER_MAX_POSTS = 100; // Увеличенный лимит для тестовых пользователей
  private readonly RATE_LIMIT_WINDOW = 60 * 1000;
  private readonly CACHE_TTL = 10 * 60 * 1000;

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

  async onModuleInit() {
    try {
      await this.rabbitMQService.consume(this.queueName, (msg) => {
        void this.handleMessage(msg);
      });

      setInterval(
        () => {
          this.cleanupCaches();
        },
        5 * 60 * 1000,
      );

      this.logger.log(`Consumer subscribed to queue: ${this.queueName}`);
    } catch (error) {
      this.logger.error(
        `Error initializing consumer: ${(error as Error).message}`,
      );
    }
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

      // ДЛЯ ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ - СОХРАНЯЕМ В БД С ИЗОБРАЖЕНИЯМИ
      if (isTestUser) {
        console.log(
          `[TEST] Processing test user post in DB: ${createPostDto.userId}`,
        );

        const processedData = { ...createPostDto };

        // Обрабатываем файлы для тестовых пользователей
        this.processFiles(processedData);

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

        this.emitNewPostEvent(postWithUser);
        this.processedPostIds.add(messageHash);

        this.rabbitMQService.ackMessage(msg);
        return;
      }

      // Для обычных пользователей...
      console.log(
        `[QUEUE] Processing regular user post: ${createPostDto.userId.substring(0, 8)}...`,
      );

      const processedData = { ...createPostDto };
      let hasFiles = false;

      if (createPostDto.image && createPostDto.file) {
        const fileResult = this.commonWsService.processContentWithMultipleFiles(
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
        const fileResult = this.commonWsService.processContentWithFile(
          createPostDto.content,
          { file: createPostDto.file },
        );

        Object.assign(processedData, fileResult);
        delete processedData.file;
        hasFiles = !!fileResult?.fileUrl;
      } else if (createPostDto.image) {
        const fileResult = this.commonWsService.processContentWithFile(
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
        this.processedPostIds.add(messageHash);
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

      this.emitNewPostEvent(postWithUser);
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
  // Исправляем метод indexPostInElasticsearch
  private async indexPostInElasticsearch(
    post: Post,
    userId: string,
    isTestUser: boolean,
  ): Promise<void> {
    try {
      //ля тестовых пользователей ТОЖЕ используем данные из БД
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

  private async enrichPostWithUserData<T extends object>(
    post: T,
    userId: string,
  ): Promise<
    T & {
      user: {
        id: string;
        userName: string;
        avatarUrl: string | null;
        avatarShape: string;
        slug?: string;
        role: string;
      };
    }
  > {
    try {
      const isTestUser = this.testService.isTestUserId(userId);

      const user = await this.usersService.findById(userId);

      if (!user) {
        console.warn(`❌ User ${userId} not found`);
        return {
          ...post,
          user: {
            id: userId,
            userName: 'Unknown',
            avatarUrl: null,
            avatarShape: 'circle',
            role: isTestUser ? 'test' : 'user',
          },
        };
      }

      return {
        ...post,
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
        ...post,
        user: {
          id: userId,
          userName: 'Anonymous',
          avatarUrl: null,
          avatarShape: 'circle',
          role: 'user',
        },
      };
    }
  }

  // Остальные методы остаются без изменений...
  private processFiles(processedData: Partial<CreatePostDto>): void {
    if (processedData.image && processedData.file) {
      const fileResult = this.commonWsService.processContentWithMultipleFiles(
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
      const fileResult = this.commonWsService.processContentWithFile(
        processedData.content as string,
        { file: processedData.file },
      );
      Object.assign(processedData, fileResult);
      delete processedData.file;
    } else if (processedData.image) {
      const fileResult = this.commonWsService.processContentWithFile(
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

  private emitNewPostEvent(postWithUser: any) {
    try {
      if (this.postsGateway.server) {
        this.postsGateway.server.emit('newPost', postWithUser);
      }
    } catch (error) {
      this.logger.error('Failed to emit new post event:', error);
    }
  }

  private cleanupCaches() {
    const now = Date.now();

    for (const [userId, limit] of this.userPostCounts.entries()) {
      if (now > limit.resetTime) {
        this.userPostCounts.delete(userId);
      }
    }

    if (this.processedPostIds.size > 1000) {
      this.processedPostIds.clear();
      this.logger.log('Processed posts cache cleared');
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

  emergencyCleanup() {
    this.processedPostIds.clear();
    this.userPostCounts.clear();
    this.resetStats();
    this.logger.warn('PostsConsumer emergency cleanup performed');
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
