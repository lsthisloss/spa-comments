import { OnModuleInit, OnModuleDestroy, Injectable } from '@nestjs/common';
import * as amqp from 'amqplib';
import { env } from 'node:process';
import * as dotenv from 'dotenv';

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
    return !!this.connection && !this.connection.closed;
  }
  async onModuleInit() {
    if (RabbitMQService.isInitialized) {
      this.connection = RabbitMQService.connection;
      this.channel = RabbitMQService.channel;
      return;
    }

    while (true) {
      try {
        console.log('Connecting to RabbitMQ...');
        console.log('ENV:', {
          RABBITMQ_DEFAULT_USER: process.env.RABBITMQ_DEFAULT_USER,
          RABBITMQ_DEFAULT_PASS: process.env.RABBITMQ_DEFAULT_PASS,
          RABBITMQ_DEFAULT_HOST: process.env.RABBITMQ_DEFAULT_HOST,
          RABBITMQ_DEFAULT_PORT: process.env.RABBITMQ_DEFAULT_PORT,
        });
        this.connection = await amqp.connect(
          `amqp://${process.env.RABBITMQ_DEFAULT_USER}:${process.env.RABBITMQ_DEFAULT_PASS}@${process.env.RABBITMQ_DEFAULT_HOST}:${process.env.RABBITMQ_DEFAULT_PORT}`,
        );
        this.channel = await this.connection.createChannel();

        RabbitMQService.connection = this.connection;
        RabbitMQService.channel = this.channel;
        RabbitMQService.isInitialized = true;
        break;
      } catch (error) {
        console.error('Failed to connect to RabbitMQ:', error);
        await new Promise((res) => setTimeout(res, 5000));
      }
    }

    // Listen for connection closure to reinitialize
    this.connection.on('close', () => {
      RabbitMQService.isInitialized = false;
      void this.onModuleInit(); // Attempt to reconnect
    });
  }

  async checkQueue(
    queue: string,
  ): Promise<{ messageCount: number; unacknowledgedCount: number }> {
    if (!this.channel) {
      throw new Error('Channel is not initialized.');
    }

    try {
      const { messageCount, consumerCount } = await this.channel.checkQueue(
        queue,
      );
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
      while (!RabbitMQService.isInitialized) {
        await new Promise((res) => setTimeout(res, 100));
      }
    }
  }
  async sendToQueue(
    queue: string,
    message: Record<string, any>,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized.');
    }

    try {
      await this.channel.assertQueue(queue, { durable: true });
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
      console.log(`Message sent to queue "${queue}":`, message);
    } catch (error) {
      console.error(`Failed to send message to queue "${queue}":`, error);
      throw error;
    }
  }
  public getQueueName(queueName: string): string {
    return `${'local'}${queueName}`;
  }

  async sendMessage(queueName: string, message: any): Promise<void> {
    try {
      await this.ensureChannelInitialized(queueName);
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
      await this.ensureChannelInitialized(queue);
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
