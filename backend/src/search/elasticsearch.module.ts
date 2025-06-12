import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';

@Module({
  imports: [
    ElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth:
        process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD
          ? {
              username: process.env.ELASTICSEARCH_USERNAME,
              password: process.env.ELASTICSEARCH_PASSWORD,
            }
          : undefined,
    }),
  ],
  exports: [ElasticsearchModule],
})
export class ElasticsearchCustomModule {}
