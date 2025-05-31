import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { SearchService } from './search.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/search' })
export class SearchGateway {
  constructor(private readonly searchService: SearchService) {}

  @SubscribeMessage('search')
  async handleSearch(@MessageBody() data: { query: string }) {
    return this.searchService.searchAll(data.query);
  }
}
