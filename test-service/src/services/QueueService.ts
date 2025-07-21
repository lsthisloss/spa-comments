import amqp from 'amqplib';

export interface QueueMessage {
  type: string;
  payload: any;
  timestamp: Date;
}

export class QueueService {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  async connect(url: string = 'amqp://localhost'): Promise<void> {
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
    } catch (error) {
      throw new Error(`Failed to connect to RabbitMQ: ${error}`);
    }
  }

  async sendMessage(queue: string, message: QueueMessage): Promise<void> {
    if (!this.channel) {
      throw new Error('Not connected to queue');
    }

    await this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
  }

  async consumeMessages(queue: string, callback: (message: QueueMessage) => void): Promise<void> {
    if (!this.channel) {
      throw new Error('Not connected to queue');
    }

    await this.channel.assertQueue(queue, { durable: true });
    this.channel.consume(queue, (msg) => {
      if (msg) {
        const message: QueueMessage = JSON.parse(msg.content.toString());
        callback(message);
        this.channel!.ack(msg);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}