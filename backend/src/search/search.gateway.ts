import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SearchService } from './search.service';
import { SearchResponse } from './types/search-result.types';
import { SessionService } from '../auth/session.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/search' })
export class SearchGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly searchService: SearchService,
    private readonly sessionService: SessionService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Search WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Search WS disconnected: ${client.id}`);
    this.sessionService.removeSession(client.id);
  }

  @SubscribeMessage('search')
  async handleSearch(
    @MessageBody() data: { query: string },
    @ConnectedSocket() client: Socket,
  ): Promise<SearchResponse> {
    try {
      console.log(`[Search] Query "${data.query}" from client ${client.id}`);

      const result = await this.searchService.searchAll(data.query);

      if (
        result &&
        typeof result === 'object' &&
        Array.isArray(result.users) &&
        Array.isArray(result.posts) &&
        Array.isArray(result.comments)
      ) {
        console.log(
          `[Search] Results for client ${client.id}: ${result.users.length} users, ${result.posts.length} posts, ${result.comments.length} comments`,
        );
        return result;
      } else {
        return { users: [], posts: [], comments: [] };
      }
    } catch (error) {
      console.error(`[Search] Error for client ${client.id}:`, error);
      return { users: [], posts: [], comments: [] };
    }
  }
}
