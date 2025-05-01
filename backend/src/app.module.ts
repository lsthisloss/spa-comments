import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElasticsearchCustomModule } from './elasticsearch/elasticsearch.module';

@Module({
  imports: [ElasticsearchCustomModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
