import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SearchService } from './search.service';
import { SearchResponse } from './types/search-result.types';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/search' })
export class SearchGateway {
  constructor(private readonly searchService: SearchService) {}

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
