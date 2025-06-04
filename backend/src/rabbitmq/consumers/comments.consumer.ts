import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq.service';
import { CommentsService } from '../../comments/comments.service';
import type { CreateCommentDto } from '../../comments/dto/create-comment.dto';
import { CommentsGateway } from '../../comments/comments.gateway';
import { UsersService } from '../../users/users.service';
import { CommonWsService } from '../../common/common-ws.service';
@Injectable()
export class CommentsConsumer implements OnModuleInit {
  private readonly logger = new Logger(CommentsConsumer.name);
  private readonly queueName = 'add_comment_queue';

  private processedCommentIds = new Set<string>(); // Хранит хэши обработанных комментариев
  private userCommentCounts = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly MAX_COMMENTS_PER_MINUTE = 20; // Максимум комментариев в минуту
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // Окно для rate limiting в миллисекундах
  private readonly CACHE_TTL = 10 * 60 * 1000; // TTL для кэша в миллисекундах

  // Метрики для мониторинга
  private stats = {
    totalProcessed: 0,
    rateLimitedDropped: 0,
    duplicatesDropped: 0,
    errorsCount: 0,
  };

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly commentsService: CommentsService,
    private readonly commentsGateway: CommentsGateway,
    private readonly usersService: UsersService,
    private readonly commonWsService: CommonWsService,
  ) {}
  /**
   * Инициализация потребителя сообщений RabbitMQ
   * Подписывается на очередь и обрабатывает сообщения
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
  /**
   * Обрабатывает входящие сообщения из RabbitMQ
   * @param msg - Сообщение, полученное из RabbitMQ
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
      const createCommentDto = this.parseMessageContent(content);

      if (!createCommentDto) {
        this.rabbitMQService.nackMessage(msg);
        return;
      }

      // ПРОВЕРЯЕМ RATE LIMITING
      if (
        !createCommentDto.userId ||
        !this.checkRateLimit(createCommentDto.userId)
      ) {
        this.stats.rateLimitedDropped++;
        this.logger.warn(
          `Rate limit exceeded or missing userId for user ${createCommentDto.userId}`,
        );
        this.rabbitMQService.ackMessage(msg);
        return;
      }

      // Проверка на дублирование
      const messageHash = this.generateMessageHash(createCommentDto);
      if (this.processedCommentIds.has(messageHash)) {
        this.stats.duplicatesDropped++;
        this.logger.warn(`Duplicate comment detected: ${messageHash}`);
        this.rabbitMQService.ackMessage(msg);
        return;
      }

      if (createCommentDto.image && createCommentDto.file) {
        // Есть и изображение, и файл
        const fileResult = this.commonWsService.processContentWithMultipleFiles(
          createCommentDto.content,
          {
            image: createCommentDto.image,
            file: createCommentDto.file,
          },
        );

        Object.assign(createCommentDto, fileResult);
        delete createCommentDto.image;
        delete createCommentDto.file;
      } else if (createCommentDto.file) {
        // Только файл
        const fileResult = this.commonWsService.processContentWithFile(
          createCommentDto.content,
          { file: createCommentDto.file },
        );

        Object.assign(createCommentDto, fileResult);
        delete createCommentDto.file;
      } else if (createCommentDto.image) {
        // Только изображение
        const fileResult = this.commonWsService.processContentWithFile(
          createCommentDto.content,
          { file: createCommentDto.image },
        );

        Object.assign(createCommentDto, fileResult);
        delete createCommentDto.image;
      }

      // Сохраняем комментарий
      const comment =
        await this.commentsService.saveCommentFromQueue(createCommentDto);

      // Обогащаем данными пользователя с ROLE
      const commentWithUser: Awaited<
        ReturnType<typeof this.enrichCommentWithUserData>
      > = await this.enrichCommentWithUserData(
        comment,
        createCommentDto.userId,
      );

      // Эмитим событие
      this.emitNewCommentEvent(commentWithUser);

      // Обновляем счетчики
      this.updateRateLimit(createCommentDto.userId);
      this.processedCommentIds.add(messageHash);

      this.rabbitMQService.ackMessage(msg);
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error('Error processing comment:', error);
      this.rabbitMQService.nackMessage(msg);
    }
  }
  /**
   * Проверяет, не превышает ли пользователь лимит комментариев в минуту
   * @param userId - ID пользователя
   * @returns true, если лимит не превышен, иначе false
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.userCommentCounts.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      this.userCommentCounts.set(userId, {
        count: 0,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return true;
    }

    return userLimit.count < this.MAX_COMMENTS_PER_MINUTE;
  }
  /**
   * Обновляет счетчик комментариев для пользователя
   * @param userId - ID пользователя
   */
  private updateRateLimit(userId: string): void {
    const userLimit = this.userCommentCounts.get(userId);
    if (userLimit) {
      userLimit.count++;
    }
  }
  /**
   * Обогащает комментарий данными пользователя
   * @param comment - Комментарий, полученный из RabbitMQ
   * @param userId - ID пользователя
   * @returns Обогащенный комментарий с данными пользователя
   */
  private async enrichCommentWithUserData(
    comment: Record<string, any>,
    userId: string,
  ): Promise<
    Record<string, any> & {
      postId: string;
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
        ...comment,
        postId: comment.postId as string,
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
        ...comment,
        postId: comment.postId as string,
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
  /**
   * Эмитит событие о новом комментарии
   * @param commentWithUser - Комментарий с данными пользователя
   */
  private emitNewCommentEvent(commentWithUser: {
    [key: string]: any;
    postId: string;
  }) {
    try {
      if (this.commentsGateway) {
        this.commentsGateway.emitNewComment(commentWithUser);
      }
    } catch (error) {
      this.logger.error('Failed to emit new comment event:', error);
    }
  }
  /**
   * Очищает кэши и счетчики
   * Вызывается периодически для предотвращения переполнения памяти
   */
  private cleanupCaches() {
    const now = Date.now();

    // Очищаем rate limit кэш
    for (const [userId, limit] of this.userCommentCounts.entries()) {
      if (now > limit.resetTime) {
        this.userCommentCounts.delete(userId);
      }
    }

    // Очищаем processed comments кэш
    if (this.processedCommentIds.size > 1000) {
      this.processedCommentIds.clear();
      this.logger.log('Processed comments cache cleared');
    }
  }

  // Метод для сброса статистики
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      rateLimitedDropped: 0,
      duplicatesDropped: 0,
      errorsCount: 0,
    };
    this.logger.log('CommentsConsumer stats reset');
  }

  // Метод для emergency cleanup
  emergencyCleanup() {
    this.processedCommentIds.clear();
    this.userCommentCounts.clear();
    this.resetStats();
    this.logger.warn('CommentsConsumer emergency cleanup performed');
  }

  // Геттеры для размеров кэшей (для внешнего мониторинга)
  getProcessedCacheSize(): number {
    return this.processedCommentIds.size;
  }

  getRateLimitEntries(): number {
    return this.userCommentCounts.size;
  }

  // Дополняем существующий getStats() метод
  getStats() {
    return {
      ...this.stats,
      processedCacheSize: this.processedCommentIds.size,
      rateLimitEntries: this.userCommentCounts.size,
      maxCommentsPerMinute: this.MAX_COMMENTS_PER_MINUTE,
      timestamp: new Date().toISOString(),
    };
  }
  /*  * Проверяет, является ли сообщение валидным
   * @param msg - Сообщение, полученное из RabbitMQ
   * @returns true, если сообщение валидно, иначе false
   */
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
  /**
   * Парсит содержимое сообщения и возвращает CreateCommentDto
   * @param content - Содержимое сообщения в виде строки
   * @returns CreateCommentDto или null, если парсинг не удался
   */
  private parseMessageContent(content: string): CreateCommentDto | null {
    try {
      const parsed = JSON.parse(content) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'createCommentDto' in parsed &&
        typeof (parsed as { createCommentDto?: unknown }).createCommentDto ===
          'object' &&
        (parsed as { createCommentDto?: unknown }).createCommentDto !== null &&
        'userId' in
          ((parsed as { createCommentDto: any }).createCommentDto ?? {}) &&
        'content' in
          ((parsed as { createCommentDto: any }).createCommentDto ?? {})
      ) {
        return (parsed as { createCommentDto: CreateCommentDto })
          .createCommentDto;
      }
      return null;
    } catch {
      return null;
    }
  }
  /**
   * Генерирует хэш сообщения для предотвращения дублирования
   * @param createCommentDto - DTO комментария
   * @returns Хэш сообщения
   */
  private generateMessageHash(createCommentDto: CreateCommentDto): string {
    const timeWindow = Math.floor(Date.now() / 3000); // 3-секундные окна
    return `${createCommentDto.userId}-${createCommentDto.postId}-${timeWindow}-${createCommentDto.content.substring(0, 30)}`;
  }
}
