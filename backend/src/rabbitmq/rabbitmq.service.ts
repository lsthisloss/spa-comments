import { OnModuleInit, OnModuleDestroy, Injectable } from '@nestjs/common';
import * as amqp from 'amqplib';
import * as dotenv from 'dotenv';
import { createConnection } from 'net';

dotenv.config();

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  constructor() {
    console.log('RabbitMQService instance created');
  }
  private static isInitialized = false;
  private static connection: amqp.Connection;
  private static channel: amqp.Channel;

  public connection: amqp.Connection;
  public channel: amqp.Channel;
  public chunkLengthLimit: number = 500;

  isConnected(): boolean {
    return (
      !!this.connection &&
      typeof (this.connection as { closed?: boolean }).closed === 'boolean' &&
      !(this.connection as { closed: boolean }).closed
    );
  }

  private getRabbitMQConfig() {
    // Поддерживаем разные варианты переменных окружения
    const user = process.env.RABBITMQ_USER;
    const pass = process.env.RABBITMQ_PASSWORD;
    const host = process.env.RABBITMQ_HOST;
    const port = process.env.RABBITMQ_PORT;

    // Если есть готовый URL, используем его
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

        // Дополнительная пауза для полной готовности
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return;
      } catch (error) {
        console.log(
          `⏳ RabbitMQ not ready (${i + 1}/${maxRetries}): ${(error as Error).message}`,
        );
        if (i === maxRetries - 1) {
          console.warn('⚠️  RabbitMQ not available, continuing without it...');
          return; // Не падаем, если RabbitMQ недоступен
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  async onModuleInit() {
    if (RabbitMQService.isInitialized) {
      if (RabbitMQService.connection && RabbitMQService.channel) {
        this.connection = RabbitMQService.connection;
        this.channel = RabbitMQService.channel;
        return;
      } else {
        throw new Error(
          'RabbitMQ static connection or channel is not initialized.',
        );
      }
    }

    // Ждем готовности RabbitMQ
    await this.waitForRabbitMQ();

    const maxRetries = 10;
    let retryCount = 0;

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

        const connection: amqp.Connection = await amqp.connect(url);
        if (!connection || typeof connection !== 'object') {
          throw new Error('Failed to establish a RabbitMQ connection.');
        }
        this.connection = connection;
        this.channel = await this.connection.createChannel();

        RabbitMQService.connection = this.connection;
        RabbitMQService.channel = this.channel;
        RabbitMQService.isInitialized = true;

        console.log('✅ RabbitMQ connected successfully!');
        break;
      } catch (error) {
        retryCount++;
        console.error(
          `Failed to connect to RabbitMQ (attempt ${retryCount}/${maxRetries}):`,
          (error as Error).message,
        );

        if (retryCount >= maxRetries) {
          console.warn(
            '⚠️  Maximum RabbitMQ connection attempts reached. Service will continue without RabbitMQ.',
          );
          return; // Не падаем, продолжаем работу без RabbitMQ
        }

        await new Promise((res) => setTimeout(res, 5000));
      }
    }

    // Listen for connection closure to reinitialize
    if (this.connection) {
      this.connection.on('close', () => {
        console.log(
          '🔌 RabbitMQ connection closed, attempting to reconnect...',
        );
        RabbitMQService.isInitialized = false;
        setTimeout(() => {
          void this.onModuleInit(); // Attempt to reconnect after delay
        }, 5000);
      });
    }
  }

  async checkQueue(
    queue: string,
  ): Promise<{ messageCount: number; unacknowledgedCount: number }> {
    if (!this.channel) {
      throw new Error('Channel is not initialized.');
    }

    try {
      if (
        !(this.channel instanceof Object) ||
        typeof this.channel?.checkQueue !== 'function'
      ) {
        throw new Error(
          'Channel is not initialized or checkQueue is not a function.',
        );
      }

      const { messageCount, consumerCount } = await this.channel.checkQueue(queue);
      if (messageCount === undefined || consumerCount === undefined) {
        throw new Error('Failed to retrieve queue information.');
      }

      // Get the prefetch count (number of messages sent to consumers before being acked)
      const prefetchCount = this.channel.prefetchCount || 1; // Default to 1 if not set

      const unacknowledgedCount = messageCount - consumerCount * prefetchCount;

      return { messageCount, unacknowledgedCount };
    } catch (error) {
      console.error(`Failed to check queue ${queue}:`, error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection && typeof this.connection.close === 'function') {
        await this.connection.close();
      }
    } catch (error) {
      console.error('Failed to close RabbitMQ connection or channel:', error);
    }
  }

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
      await this.channel.assertQueue(queue, { durable: true });
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
      console.log(`Message sent to queue "${queue}":`, message);
    } catch (error) {
      console.error(`Failed to send message to queue "${queue}":`, error);
      // Не бросаем ошибку, просто логируем
    }
  }

  public getQueueName(queueName: string): string {
    return `${'local'}${queueName}`;
  }

  async sendMessage(queueName: string, message: any): Promise<void> {
    try {
      const initialized = await this.ensureChannelInitialized(queueName);
      if (!initialized) return;

      const queue = this.getQueueName(queueName);
      await this.channel.assertQueue(queue, { durable: true });
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
      console.log(`Message sent to queue ${queueName}`);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  async consume(queue: string, callback: (msg: amqp.ConsumeMessage) => void) {
    try {
      const initialized = await this.ensureChannelInitialized(queue);
      if (!initialized) return;

      await this.channel.prefetch(this.chunkLengthLimit);
      await this.channel.assertQueue(queue, { durable: true });
      this.channel.consume(queue, (msg) => {
        if (msg) {
          callback(msg);
        }
      });
    } catch (error) {
      console.error(`Error while consuming queue ${queue}:`, error);
    }
  }

  ackMessage(msg: amqp.ConsumeMessage): void {
    if (this.channel) {
      this.channel.ack(msg);
    } else {
      console.error('Channel is not initialized. Cannot ack message.');
    }
  }

  nackMessage(msg: amqp.ConsumeMessage, allUpTo = false, requeue = true): void {
    if (this.channel) {
      this.channel.nack(msg, allUpTo, requeue);
    } else {
      console.error('Channel is not initialized. Cannot nack message.');
    }
  }
}
