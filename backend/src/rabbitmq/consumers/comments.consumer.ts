import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq.service';
import { CommentsService } from '../../comments/comments.service';
import type { CreateCommentDto } from '../../comments/dto/create-comment.dto';
import { CommentsGateway } from 'src/comments/comments.gateway';

@Injectable()
export class CommentsConsumer implements OnModuleInit {
  private readonly logger = new Logger(CommentsConsumer.name);
  private readonly queueName = 'add_comment_queue';
  private processedCommentIds = new Set<string>(); // Кэш для предотвращения дублирования

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly commentsService: CommentsService,
    private readonly commentsGateway: CommentsGateway,
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
      const createCommentDto = this.parseMessageContent(content);

      if (!createCommentDto) {
        this.rabbitMQService.nackMessage(msg);
        return;
      }

      // Проверка на дублирование
      const messageHash = this.generateMessageHash(createCommentDto);
      if (this.processedCommentIds.has(messageHash)) {
        this.logger.warn(
          `Duplicate comment detected, skipping: ${messageHash}`,
        );
        this.rabbitMQService.ackMessage(msg);
        return;
      }

      // Сохраняем комментарий в базе
      const comment =
        await this.commentsService.saveCommentFromQueue(createCommentDto);
      this.logger.log(`Comment created successfully: ${comment.id}`);

      // Эмитим событие нового комментария
      this.emitNewCommentEvent(comment);

      // Добавляем в кэш обработанных
      this.processedCommentIds.add(messageHash);
      this.cleanupProcessedCache();

      // Подтверждаем обработку
      this.rabbitMQService.ackMessage(msg);
    } catch (error) {
      this.logger.error('Error processing comment message:', error);
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

  private parseMessageContent(content: string): CreateCommentDto | null {
    try {
      const parsed = JSON.parse(content) as {
        createCommentDto: CreateCommentDto;
      };

      if (
        !parsed.createCommentDto ||
        !parsed.createCommentDto.userId ||
        !parsed.createCommentDto.content
      ) {
        this.logger.error('Invalid comment data structure', parsed);
        return null;
      }

      return parsed.createCommentDto;
    } catch (parseError) {
      this.logger.error('Failed to parse message content as JSON', parseError);
      return null;
    }
  }

  private generateMessageHash(createCommentDto: CreateCommentDto): string {
    const now = Date.now();
    const timeWindow = Math.floor(now / 3000); // 3-секундные окна для комментариев
    return `${createCommentDto.userId}-${createCommentDto.postId}-${timeWindow}-${createCommentDto.content.substring(0, 30)}`;
  }

  private emitNewCommentEvent(comment: any) {
    try {
      // Проверяем, что gateway доступен
      if (!this.commentsGateway) {
        this.logger.error('CommentsGateway not available');
        return;
      }

      // Проверяем наличие необходимого свойства postId
      if (
        !comment ||
        typeof comment !== 'object' ||
        comment === null ||
        !('postId' in comment) ||
        typeof (comment as { postId?: unknown }).postId !== 'string'
      ) {
        this.logger.error(
          'Comment is missing required postId property',
          comment,
        );
        return;
      }

      // Эмитим событие нового комментария (без await, т.к. метод не возвращает Promise)
      this.commentsGateway.emitNewComment(
        comment as { [key: string]: any; postId: string },
      );
      const typedComment = comment as { id: string; postId: string };
      this.logger.log(
        'New comment event emitted for comment:',
        typedComment.id,
        'on post:',
        typedComment.postId,
      );
    } catch (error) {
      this.logger.error('Failed to emit new comment event:', error);
    }
  }

  private cleanupProcessedCache() {
    // Очищаем кэш каждые 500 сообщений
    if (this.processedCommentIds.size > 500) {
      this.processedCommentIds.clear();
      this.logger.log('Processed comments cache cleared');
    }
  }
}
