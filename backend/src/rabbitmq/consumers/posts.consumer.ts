import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq.service';
import { PostsService } from '../../posts/posts.service';
import type { CreatePostDto } from '../../posts/dto/create-post.dto';
import { PostsGateway } from '../../posts/posts.gateway';
import { UsersService } from '../../users/users.service';

@Injectable()
export class PostsConsumer implements OnModuleInit {
  private readonly logger = new Logger(PostsConsumer.name);
  private readonly queueName = 'add_post_queue';

  private processedPostIds = new Set<string>(); // Используем Set для хранения уникальных идентификаторов постов
  private userPostCounts = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly MAX_POSTS_PER_MINUTE = 10; // Максимум 10 постов в минуту на пользователя
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 60 секунд
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 минут

  // Метрики для мониторинга
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
  ) {}
  /* Метод, вызываемый при инициализации модуля
   * Подписывается на очередь RabbitMQ и начинает обработку сообщений
   * Также запускает периодическую очистку кэша
   */
  async onModuleInit() {
    try {
      await this.rabbitMQService.consume(this.queueName, (msg) => {
        void this.handleMessage(msg);
      });

      // Периодическая очистка кэша
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
  /* Метод для обработки сообщений из очереди
   * @param msg - сообщение из очереди RabbitMQ
   * Обрабатывает сообщение, проверяет rate limiting, дублирование и создает пост
   */
  private async handleMessage(msg: any) {
    try {
      this.stats.totalProcessed++;

      if (!this.isValidMessage(msg)) {
        this.logger.error('Invalid message format');
        this.rabbitMQService.nackMessage(msg);
        return;
      }

      const content = msg.content.toString();
      const createPostDto = this.parseMessageContent(content);

      if (!createPostDto) {
        this.rabbitMQService.nackMessage(msg);
        return;
      }

      // ПРОВЕРЯЕМ RATE LIMITING (дублированная проверка для безопасности)
      if (!this.checkRateLimit(createPostDto.userId)) {
        this.stats.rateLimitedDropped++;
        this.logger.warn(
          `❌ Rate limit exceeded for user ${createPostDto.userId} - POST DROPPED. Stats: ${this.stats.rateLimitedDropped} dropped total`,
        );

        //Помечаем сообщение как обработанное, но пост не создаем
        this.rabbitMQService.ackMessage(msg);
        return;
      }

      // Проверка на дублирование
      const messageHash = this.generateMessageHash(createPostDto);
      if (this.processedPostIds.has(messageHash)) {
        this.stats.duplicatesDropped++;
        this.logger.warn(
          `❌ Duplicate post detected: ${messageHash} - POST DROPPED`,
        );
        this.rabbitMQService.ackMessage(msg);
        return;
      }

      // Сохраняем пост
      const post = await this.postsService.createPost(createPostDto);
      this.logger.log(
        `Post created successfully: ${post.id} for user ${createPostDto.userId}`,
      );

      // Получаем данные пользователя с ROLE
      const postWithUser = await this.enrichPostWithUserData(
        post,
        createPostDto.userId,
      );

      // Эмитим событие
      this.emitNewPostEvent(postWithUser);

      // Обновляем счетчики
      this.updateRateLimit(createPostDto.userId);
      this.processedPostIds.add(messageHash);

      this.rabbitMQService.ackMessage(msg);
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error('❌ Error processing post:', error);
      this.rabbitMQService.nackMessage(msg);
    }
  }

  /* Метод для получения детализированной статистики
   * Возвращает объект со статистикой потребителя, включая активные rate limits
   */
  getDetailedStats() {
    const now = Date.now();
    const activeRateLimits = Array.from(this.userPostCounts.entries())
      .filter(([, limit]) => now <= limit.resetTime)
      .map(([userId, limit]) => ({
        userId,
        count: limit.count,
        remaining: this.MAX_POSTS_PER_MINUTE - limit.count,
        resetIn: Math.ceil((limit.resetTime - now) / 1000),
      }));

    return {
      ...this.getStats(),
      activeRateLimits,
      rateLimitSummary: {
        usersWithLimits: activeRateLimits.length,
        totalDropped: this.stats.rateLimitedDropped,
        maxPostsPerMinute: this.MAX_POSTS_PER_MINUTE,
      },
    };
  }
  // Проверяем rate limit для пользователя
  // Возвращает true, если пользователь может создать пост, иначе false
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
  /* Метод для обновления счетчика rate limit
   * Увеличивает счетчик для пользователя и сбрасывает время, если лимит достигнут
   * @param userId - идентификатор пользователя
   */
  private updateRateLimit(userId: string): void {
    const userLimit = this.userPostCounts.get(userId);
    if (userLimit) {
      userLimit.count++;
    }
  }
  /* Метод для обогащения поста данными пользователя
   * @param post - пост, который нужно обогатить
   * @param userId - идентификатор пользователя
   * @returns обогащенный пост с данными пользователя
   */
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
      const user = await this.usersService.findById(userId);

      return {
        ...post,
        user: {
          id: userId,
          userName: user?.userName || 'Anonymous',
          avatarUrl: user?.avatarUrl || null,
          avatarShape: user?.avatarShape || 'circle',
          slug: user?.slug,
          role: user?.role || 'user',
        },
      };
    } catch {
      this.logger.warn(`Failed to get user data for ${userId}`);
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
  /* Метод для эмита события нового поста
   * @param postWithUser - пост с данными пользователя
   */
  private emitNewPostEvent(postWithUser: any) {
    try {
      if (this.postsGateway.server) {
        this.postsGateway.server.emit('newPost', postWithUser);
      }
    } catch (error) {
      this.logger.error('Failed to emit new post event:', error);
    }
  }
  /*  Метод для очистки кэшей
   * Очищает кэш rate limit и processed posts
   */
  private cleanupCaches() {
    const now = Date.now();

    // Очищаем rate limit кэш
    for (const [userId, limit] of this.userPostCounts.entries()) {
      if (now > limit.resetTime) {
        this.userPostCounts.delete(userId);
      }
    }

    // Очищаем processed posts кэш
    if (this.processedPostIds.size > 1000) {
      this.processedPostIds.clear();
      this.logger.log('Processed posts cache cleared');
    }
  }

  /* Метод для получения статистики
   * Возвращает объект со статистикой потребителя
   */
  getStats() {
    return {
      ...this.stats,
      processedCacheSize: this.processedPostIds.size,
      rateLimitEntries: this.userPostCounts.size,
      maxPostsPerMinute: this.MAX_POSTS_PER_MINUTE,
      timestamp: new Date().toISOString(),
    };
  }

  // Метод для сброса статистики
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      rateLimitedDropped: 0,
      duplicatesDropped: 0,
      errorsCount: 0,
    };
    this.logger.log('PostsConsumer stats reset');
  }

  // Метод для emergency cleanup
  emergencyCleanup() {
    this.processedPostIds.clear();
    this.userPostCounts.clear();
    this.resetStats();
    this.logger.warn('PostsConsumer emergency cleanup performed');
  }

  // Геттеры для размеров кэшей (для внешнего мониторинга)
  getProcessedCacheSize(): number {
    return this.processedPostIds.size;
  }
  // Возвращает количество пользователей с активными rate limit
  getRateLimitEntries(): number {
    return this.userPostCounts.size;
  }

  // Проверяем, что сообщение имеет правильный формат
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
  // Парсим содержимое сообщения и возвращаем CreatePostDto или null
  private parseMessageContent(content: string): CreatePostDto | null {
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
        const dto = (parsed as { createPostDto: Partial<CreatePostDto> })
          .createPostDto;
        if (typeof dto.userId === 'string' && typeof dto.content === 'string') {
          return dto as CreatePostDto;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  // Генерируем хэш сообщения для проверки дубликатов
  private generateMessageHash(createPostDto: CreatePostDto): string {
    const timeWindow = Math.floor(Date.now() / 5000); // 5-секундные окна
    return `${createPostDto.userId}-${timeWindow}-${createPostDto.content.substring(0, 50)}`;
  }
}
