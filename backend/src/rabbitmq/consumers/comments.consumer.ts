import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq.service';
import { CommentsService } from '../../comments/comments.service';

@Injectable()
export class CommentsConsumer implements OnModuleInit {
  private readonly logger = new Logger(CommentsConsumer.name);
  private readonly queueName = 'add_comment_queue';

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly commentsService: CommentsService,
  ) {}

  async onModuleInit() {
    try {
      await this.rabbitMQService.consume(this.queueName, async (msg) => {
        if (msg) {
          const { createCommentDto } = JSON.parse(msg.content.toString()); // Извлекаем createCommentDto
          console.log(`Received message from queue "${this.queueName}":`, createCommentDto);
  
          // Сохраняем комментарий в базу данных
          await this.commentsService.createComment(createCommentDto);
  
          // Подтверждаем обработку сообщения
          this.rabbitMQService.ackMessage(msg);
        } else {
          console.log(`Received null message in queue: ${this.queueName}`);
          this.rabbitMQService.nackMessage(msg); // Отправляем отрицательное подтверждение
        }
      });
  
      console.log(`Consumer successfully subscribed to queue: ${this.queueName}`);
    } catch (error) {
      console.error(`Error initializing consumer for queue "${this.queueName}": ${error.message}`, error.stack);
    }
  }
}