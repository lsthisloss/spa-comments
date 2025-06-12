import { OnModuleInit, OnModuleDestroy, Injectable } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { Connection, ConsumeMessage, Channel } from 'amqplib';
import * as dotenv from 'dotenv';
import { createConnection } from 'net';

dotenv.config();

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  constructor() {
    console.log('RabbitMQService instance created');
  }
  private static connection: Connection;
  private static isInitialized = false;
  public connection: Connection;
  public chunkLengthLimit: number = 100;
  private static channel: Channel;
  public channel: Channel;
  // Настройки ограничений очередей
  private readonly queueOptions = {
    durable: true,
    arguments: {
      'x-max-length': parseInt(process.env.RABBITMQ_QUEUE_MAX_LENGTH || '5000'),
      'x-max-length-bytes': parseInt(
        process.env.RABBITMQ_QUEUE_MAX_BYTES || '50000000',
      ), // 50MB
      'x-overflow': 'drop-head', // Удаляем старые сообщения
      'x-message-ttl': parseInt(process.env.RABBITMQ_MESSAGE_TTL || '300000'), // 5 минут
      'x-queue-mode': 'lazy', // Экономим память
    },
  };
  /**
   * Проверяет, подключен ли RabbitMQ.
   * @returns {boolean} true, если RabbitMQ подключен, иначе false.
   */
  isConnected(): boolean {
    return (
      !!this.connection &&
      typeof (this.connection as { closed?: boolean }).closed === 'boolean' &&
      !(this.connection as { closed: boolean }).closed
    );
  }
  /**
   * Получает конфигурацию RabbitMQ из переменных окружения.
   * @returns {object} Конфигурация RabbitMQ с URL, хостом и портом.
   */
  private getRabbitMQConfig() {
    const user = process.env.RABBITMQ_USER;
    const pass = process.env.RABBITMQ_PASSWORD;
    const host = process.env.RABBITMQ_HOST;
    const port = process.env.RABBITMQ_PORT;

    if (process.env.RABBITMQ_URL) {
      return {
        url: process.env.RABBITMQ_URL ?? '',
        host,
        port: parseInt(port || '5672'),
      };
    }

    return {
      url: `amqp://${user}:${pass}@${host}:${port ?? '5672'}`,
      host,
      port: parseInt(port ?? '5672'),
    };
  }
  /**
   * Ожидает, пока RabbitMQ будет доступен.
   * Проверяет доступность порта RabbitMQ в течение 30 попыток с интервалом 3 секунды.
   */
  private async waitForRabbitMQ() {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    const maxRetries = 30;
    const retryDelay = 3000;
    const { host, port } = this.getRabbitMQConfig();

    console.log(`🐰 Waiting for RabbitMQ at ${host}:${port}...`);

    for (let i = 0; i < maxRetries; i++) {
      try {
        await new Promise((resolve, reject) => {
          const socket = createConnection({ host, port }, () => {
            socket.end();
            resolve(void 0);
          });

          socket.on('error', (err) => {
            reject(err);
          });

          socket.setTimeout(3000, () => {
            socket.destroy();
            reject(new Error('Connection timeout'));
          });
        });

        console.log('✅ RabbitMQ port is open!');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return;
      } catch (error) {
        console.log(
          `⏳ RabbitMQ not ready (${i + 1}/${maxRetries}): ${(error as Error).message}`,
        );
        if (i === maxRetries - 1) {
          console.warn('⚠️  RabbitMQ not available, continuing without it...');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  async onModuleInit() {
    if (RabbitMQService.isInitialized) {
      if (RabbitMQService.connection && RabbitMQService.channel) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.connection = RabbitMQService.connection;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.channel = RabbitMQService.channel;

        // Инициализируем очереди с ограничениями
        await this.setupQueues();
        return;
      } else {
        throw new Error(
          'RabbitMQ static connection or channel is not initialized.',
        );
      }
    }

    await this.waitForRabbitMQ();

    const maxRetries = 10;
    let retryCount = 0;
    // Проверяем, что amqplib загружен корректно
    while (retryCount < maxRetries) {
      try {
        const { url } = this.getRabbitMQConfig();
        console.log('Connecting to RabbitMQ...');
        console.log('RabbitMQ Config:', {
          RABBITMQ_URL: process.env.RABBITMQ_URL,
          RABBITMQ_USER: process.env.RABBITMQ_USER,
          RABBITMQ_PASSWORD: process.env.RABBITMQ_PASSWORD ? '***' : undefined,
          RABBITMQ_HOST: process.env.RABBITMQ_HOST,
          RABBITMQ_PORT: process.env.RABBITMQ_PORT,
          computed_url: url.replace(/:[^:@]*@/, ':***@'),
          attempt: retryCount + 1,
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof amqp !== 'object' || typeof amqp.connect !== 'function') {
          throw new Error('amqplib failed to load or is not a valid module.');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof amqp !== 'object' || typeof amqp.connect !== 'function') {
          throw new Error('amqplib failed to load or is not a valid module.');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const connection: amqp.Connection = await amqp.connect(url);

        if (!connection || typeof connection !== 'object') {
          throw new Error('Failed to establish a RabbitMQ connection.');
        }

        if (!connection || typeof connection !== 'object') {
          throw new Error('Failed to establish a RabbitMQ connection.');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.connection = connection;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.channel = await this.connection.createChannel();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await this.channel.prefetch(this.chunkLengthLimit);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        RabbitMQService.connection = this.connection;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        RabbitMQService.channel = this.channel;
        RabbitMQService.isInitialized = true;

        // Инициализируем очереди с ограничениями
        await this.setupQueues();

        console.log('✅ RabbitMQ connected successfully with memory limits!');
        break;
      } catch {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.warn(
            '⚠️  Maximum RabbitMQ connection attempts reached. Service will continue without RabbitMQ.',
          );
          return;
        }

        await new Promise((res) => setTimeout(res, 5000));
      }
    }

    if (this.connection) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.connection.on('close', () => {
        console.log(
          '🔌 RabbitMQ connection closed, attempting to reconnect...',
        );
        RabbitMQService.isInitialized = false;
        setTimeout(() => {
          void this.onModuleInit();
        }, 5000);
      });
    }
  }

  /**
   * Инициализирует очереди RabbitMQ с ограничениями.
   * Создает две очереди: для постов и комментариев.
   */
  private async setupQueues() {
    if (!this.channel) return;

    try {
      // Очередь для постов
      if (
        this.channel &&
        !(this.channel instanceof Error) &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        typeof this.channel.assertQueue === 'function'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await this.channel.assertQueue(
          'localadd_post_queue',
          this.queueOptions,
        );
        console.log(
          '✅ Posts queue initialized with limits:',
          this.queueOptions.arguments,
        );
      } else {
        throw new Error(
          'Channel is not initialized or assertQueue is not a function.',
        );
      }

      // Очередь для комментариев
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.channel.assertQueue(
        'localadd_comment_queue',
        this.queueOptions,
      );
      console.log(
        '✅ Comments queue initialized with limits:',
        this.queueOptions.arguments,
      );
    } catch (error) {
      console.error('Failed to setup queues with limits:', error);
    }
  }
  /**
   * Проверяет, инициализирован ли RabbitMQ.
   * @returns {boolean} true, если RabbitMQ инициализирован, иначе false.
   */
  async checkQueue(
    queue: string,
  ): Promise<{ messageCount: number; unacknowledgedCount: number }> {
    if (!this.channel) {
      throw new Error('Channel is not initialized.');
    }

    try {
      if (
        !(this.channel instanceof Object) ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        typeof this.channel?.checkQueue !== 'function'
      ) {
        throw new Error(
          'Channel is not initialized or checkQueue is not a function.',
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = (await this.channel.checkQueue(queue)) as {
        messageCount: number;
        consumerCount: number;
      };
      const { messageCount, consumerCount } = result;
      if (messageCount === undefined || consumerCount === undefined) {
        throw new Error('Failed to retrieve queue information.');
      }

      // amqplib does not expose prefetchCount, so we just return messageCount as unacknowledgedCount
      const unacknowledgedCount = messageCount;

      return { messageCount, unacknowledgedCount };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Failed to check queue ${queue}:`, error.message);
      } else {
        console.error(`Failed to check queue ${queue}:`, error);
      }
      throw error;
    }
  }
  /**
   * Закрывает соединение и канал RabbitMQ при уничтожении модуля.
   */
  async onModuleDestroy() {
    try {
      // Добавляем проверку на наличие метода close у канала
      if (
        this.channel &&
        typeof this.channel === 'object' &&
        'close' in this.channel &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        typeof this.channel.close === 'function'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await this.channel.close();
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (this.connection && typeof this.connection.close === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await this.connection.close();
      }
    } catch (error) {
      console.error('Failed to close RabbitMQ connection or channel:', error);
    }
  }
  /**
   * Проверяет, инициализирован ли RabbitMQ и ждет его готовности.
   * @param queueName Имя очереди для логирования.
   * @returns {Promise<boolean>} true, если RabbitMQ инициализирован, иначе false.
   */
  private async ensureChannelInitialized(queueName: string) {
    if (!RabbitMQService.isInitialized) {
      console.log(queueName + '. Waiting for RabbitMQ to be initialized...');
      let waitCount = 0;
      while (!RabbitMQService.isInitialized && waitCount < 100) {
        await new Promise((res) => setTimeout(res, 100));
        waitCount++;
      }

      if (!RabbitMQService.isInitialized) {
        console.warn(
          `${queueName}. RabbitMQ not initialized after waiting, skipping operation.`,
        );
        return false;
      }
    }
    return true;
  }
  /**
   * Отправляет сообщение в очередь RabbitMQ с ограничениями.
   * @param queue Имя очереди.
   * @param message Сообщение для отправки.
   */
  async sendToQueue(
    queue: string,
    message: Record<string, any>,
  ): Promise<void> {
    if (!this.channel) {
      console.warn(
        'RabbitMQ channel is not initialized. Message will be skipped.',
      );
      return;
    }

    try {
      // Используем ограниченные настройки очереди
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.channel.assertQueue(queue, this.queueOptions);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const success: boolean = this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          priority: this.getMessagePriority(message),
        },
      ) as boolean;

      if (!success) {
        console.warn(`Queue ${queue} is full, message may be dropped`);
      } else {
        console.log(`Message sent to queue "${queue}":`, message);
      }
    } catch (error: unknown) {
      console.error(`Failed to send message to queue "${queue}":`, error);
    }
  }

  /**
   * Отправляет сообщение в очередь RabbitMQ с ограничениями.
   * @param queueName Имя очереди.
   * @param message Сообщение для отправки.
   */
  async sendMessage(
    queueName: string,
    message: Record<string, any>,
  ): Promise<void> {
    try {
      const initialized = await this.ensureChannelInitialized(queueName);
      if (!initialized || !this.channel) return;

      const queue = this.getQueueName(queueName);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.channel.assertQueue(queue, this.queueOptions);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const success: boolean = this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          priority: this.getMessagePriority(message),
        },
      ) as boolean;

      if (!success) {
        console.warn(`Queue ${queueName} is full, message may be dropped`);
      } else {
        console.log(`Message sent to queue ${queueName}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  /**
   * Потребляет сообщения из очереди RabbitMQ с ограничениями.
   * @param queue Имя очереди для потребления.
   * @param callback Функция обратного вызова для обработки сообщений.
   */
  async consume(queue: string, callback: (msg: amqp.ConsumeMessage) => void) {
    try {
      const initialized = await this.ensureChannelInitialized(queue);
      if (!initialized || !this.channel) return;

      // Уменьшаем prefetch для экономии памяти
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.channel.prefetch(this.chunkLengthLimit);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.channel.assertQueue(queue, this.queueOptions);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.channel.consume(queue, (msg) => {
        if (msg) {
          callback(msg);
        }
      });
    } catch (error) {
      console.error(`Error while consuming queue ${queue}:`, error);
    }
  }

  /**
   * Получает приоритет сообщения на основе его типа.
   * Комментарии имеют более высокий приоритет, чем посты.
   * @param message Сообщение для определения приоритета.
   * @returns {number} Приоритет сообщения.
   */
  private getMessagePriority(message: Record<string, any>): number {
    // Комментарии имеют более высокий приоритет чем посты
    if (message.createCommentDto) return 5;
    if (message.createPostDto) return 3;
    return 1;
  }

  /**
   * Формирует имя очереди с префиксом 'local'.
   * @param queueName Имя очереди без префикса.
   * @returns {string} Полное имя очереди с префиксом.
   */
  public getQueueName(queueName: string): string {
    return `${'local'}${queueName}`;
  }

  /**
   * Подтверждает обработку сообщения.
   * @param msg Сообщение для подтверждения.
   */
  ackMessage(msg: amqp.ConsumeMessage): void {
    if (
      this.channel &&
      typeof this.channel === 'object' &&
      'ack' in this.channel &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typeof this.channel.ack === 'function'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.channel.ack(msg);
    } else {
      console.error('Channel is not initialized properly. Cannot ack message.');
    }
  }

  /**
   * Отменяет подтверждение обработки сообщения.
   * @param msg Сообщение для отмены подтверждения.
   * @param allUpTo Если true, отменяет подтверждение всех предыдущих сообщений.
   * @param requeue Если true, помещает сообщение обратно в очередь.
   */
  nackMessage(msg: ConsumeMessage, allUpTo = false, requeue = true): void {
    if (
      this.channel &&
      typeof this.channel === 'object' &&
      'nack' in this.channel &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typeof this.channel.nack === 'function'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.channel.nack(msg, allUpTo, requeue);
    } else {
      console.error(
        'Channel is not initialized properly. Cannot nack message.',
      );
    }
  }

  /**
   * Получает статистику очередей RabbitMQ.
   * @returns {Promise<{ posts: any; comments: any; timestamp: string } | null>} Статистика очередей или null, если канал не инициализирован.
   */
  async getQueueStats() {
    if (!this.channel) return null;

    try {
      const postQueue = await this.checkQueue('localadd_post_queue');
      const commentQueue = await this.checkQueue('localadd_comment_queue');

      return {
        posts: postQueue,
        comments: commentQueue,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return null;
    }
  }
}
