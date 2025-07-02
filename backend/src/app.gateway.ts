import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SessionService } from './auth/session.service';

@WebSocketGateway({
  namespace: '/', // Основной namespace
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class AppGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private interval: NodeJS.Timeout;

  constructor(private readonly sessionService: SessionService) {}

  afterInit() {
    console.log('[AppGateway] Socket.IO server initialized');

    this.interval = setInterval(() => {
      this.server.emit('heartbeat', { message: 'Server heartbeat' });
    }, 10000);
  }

  handleConnection(client: Socket) {
    console.log(
      `[AppGateway] Client connected: ${client.id} to namespace: ${client.nsp.name}`,
    );
    console.log(`[AppGateway] Transport: ${client.conn.transport.name}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[AppGateway] Client disconnected: ${client.id}`);
    this.sessionService.removeSession(client.id);
  }

  broadcastEvent(event: string, data: any) {
    console.log(`[AppGateway] Broadcasting event: ${event}`);
    this.server.emit(event, data);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
