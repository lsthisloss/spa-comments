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
  private processedPostIds = new Set<string>(); // Кэш для предотвращения дублирования

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly postsService: PostsService,
    private readonly postsGateway: PostsGateway,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    try {
      await this.rabbitMQService.consume(this.queueName, (msg) => {
        void this.handleMessage(msg);
      });

      this.logger.log(
        `Consumer successfully subscribed to queue: ${this.queueName}`,
      );
    } catch (error) {
      this.logger.error(
        `Error initializing consumer for queue "${this.queueName}": ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  private async handleMessage(msg: any) {
    try {
      // Валидация сообщения
      if (!this.isValidMessage(msg)) {
        this.logger.error('Received invalid message format', msg);
        this.rabbitMQService.nackMessage(msg);
        return;
      }

      const content = msg.content.toString();
      const createPostDto = this.parseMessageContent(content);

      if (!createPostDto) {
        this.rabbitMQService.nackMessage(msg);
        return;
      }

      // Проверка на дублирование (по времени + пользователю + контенту)
      const messageHash = this.generateMessageHash(createPostDto);
      if (this.processedPostIds.has(messageHash)) {
        this.logger.warn(`Duplicate post detected, skipping: ${messageHash}`);
        this.rabbitMQService.ackMessage(msg);
        return;
      }

      // Сохраняем пост в базе
      const post = await this.postsService.createPost(createPostDto);
      this.logger.log(`Post created successfully: ${post.id}`);

      // Получаем полные данные пользователя
      const postWithUser = await this.enrichPostWithUserData(
        post,
        createPostDto.userId,
      );

      // Эмитим событие с дополнительной проверкой
      this.emitNewPostEvent(postWithUser);

      // Добавляем в кэш обработанных
      this.processedPostIds.add(messageHash);
      this.cleanupProcessedCache(); // Очищаем старые записи

      // Подтверждаем обработку
      this.rabbitMQService.ackMessage(msg);
    } catch (error) {
      this.logger.error('Error processing post message:', error);
      this.rabbitMQService.nackMessage(msg);
    }
  }

  private isValidMessage(
    msg: unknown,
  ): msg is { content: { toString: () => string } } {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      !(msg instanceof Error) &&
      'content' in msg &&
      typeof (msg as { content?: unknown })?.content === 'object' &&
      (msg as { content?: unknown })?.content !== null &&
      typeof (
        (msg as { content?: { toString?: unknown } })?.content as {
          toString?: unknown;
        }
      )?.toString === 'function'
    );
  }

  private parseMessageContent(content: string): CreatePostDto | null {
    try {
      const parsed = JSON.parse(content) as { createPostDto: CreatePostDto };

      if (
        !parsed.createPostDto ||
        !parsed.createPostDto.userId ||
        !parsed.createPostDto.content
      ) {
        this.logger.error('Invalid post data structure', parsed);
        return null;
      }

      return parsed.createPostDto;
    } catch (parseError) {
      this.logger.error('Failed to parse message content as JSON', parseError);
      return null;
    }
  }

  private generateMessageHash(createPostDto: CreatePostDto): string {
    const now = Date.now();
    const timeWindow = Math.floor(now / 5000); // 5-секундные окна
    return `${createPostDto.userId}-${timeWindow}-${createPostDto.content.substring(0, 50)}`;
  }

  private async enrichPostWithUserData(
    post: { id: string } & Record<string, any>,
    userId: string,
  ): Promise<
    { id: string } & {
      user: { id: string; userName: string; avatarUrl: string | null };
    } & Record<string, any>
  > {
    try {
      const user = (await this.usersService.findById(userId)) as {
        userName?: string;
        avatarUrl?: string | null;
      };
      return {
        ...post,
        id: post.id,
        user: {
          id: userId,
          userName:
            typeof user?.userName === 'string' ? user.userName : 'Anonymous',
          avatarUrl:
            typeof user?.avatarUrl === 'string' ? user.avatarUrl : null,
        },
      };
    } catch (error) {
      this.logger.warn(`Failed to get user data for ${userId}:`, error);
      return {
        ...post,
        id: post.id,
        user: {
          id: userId,
          userName: 'Anonymous',
          avatarUrl: null,
        },
      };
    }
  }

  private emitNewPostEvent(postWithUser: { id: string }) {
    try {
      // Проверяем, что gateway доступен
      if (!this.postsGateway.server) {
        this.logger.error('PostsGateway server not available');
        return;
      }

      // Эмитим событие всем клиентам
      this.postsGateway.server.emit('newPost', postWithUser);
      this.logger.log(`New post event emitted for post: ${postWithUser.id}`);
    } catch (error) {
      this.logger.error('Failed to emit new post event:', error);
    }
  }

  private cleanupProcessedCache() {
    // Очищаем кэш каждые 1000 сообщений
    if (this.processedPostIds.size > 1000) {
      this.processedPostIds.clear();
      this.logger.log('Processed posts cache cleared');
    }
  }
}
