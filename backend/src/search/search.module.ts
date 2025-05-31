import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { ElasticsearchCustomModule } from './elasticsearch.module';
import { SearchGateway } from './search.gateway';

@Module({
  imports: [ElasticsearchCustomModule],
  providers: [SearchService, SearchGateway],
  exports: [SearchService, ElasticsearchCustomModule],
})
export class SearchModule {}
