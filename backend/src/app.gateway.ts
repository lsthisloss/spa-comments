import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private interval: NodeJS.Timeout;

  constructor() {
    this.interval = setInterval(() => {
      this.server.emit('heartbeat', { message: 'Server heartbeat' });
    }, 10000);
  }

  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  broadcastEvent(event: string, data: any) {
    console.log(`Broadcasting event: ${event} with data:`, data);
    this.server.emit(event, data);
  }
  onModuleDestroy() {
    clearInterval(this.interval);
  }
}
