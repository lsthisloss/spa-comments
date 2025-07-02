import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { ElasticsearchCustomModule } from './elasticsearch.module';
import { SearchGateway } from './search.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ElasticsearchCustomModule, AuthModule],
  providers: [SearchService, SearchGateway],
  exports: [SearchService, ElasticsearchCustomModule],
})
export class SearchModule {}
