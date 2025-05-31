import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class SearchService {
  constructor(private readonly es: ElasticsearchService) {
    void this.ensureIndices();
  }

  private async ensureIndices() {
    const indices = [
      {
        name: 'users',
        mapping: {
          mappings: {
            properties: {
              userName: { type: 'text' },
              email: { type: 'text' },
              avatarUrl: { type: 'text' },
            },
          },
        },
      },
      {
        name: 'posts',
        mapping: {
          mappings: {
            properties: {
              title: { type: 'text' },
              content: { type: 'text' },
              author: { type: 'object' },
            },
          },
        },
      },
      {
        name: 'comments',
        mapping: {
          mappings: {
            properties: {
              text: { type: 'text' },
              author: { type: 'object' },
            },
          },
        },
      },
    ];

    for (const idx of indices) {
      try {
        const exists = await this.es.indices.exists({ index: idx.name });
        if (!exists) {
          await this.es.indices.create({
            index: idx.name,
            ...idx.mapping,
          });
          Logger.log(`Created index: ${idx.name}`);
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        Logger.error(`Error ensuring index ${idx.name}: ${errorMessage}`);
      }
    }
  }

  async searchAll(query: string) {
    if (!query || query.length < 1)
      return { users: [], posts: [], comments: [] };

    const should = [
      { match_phrase_prefix: { userName: query } },
      { match_phrase_prefix: { email: query } },
      { match_phrase_prefix: { title: query } },
      { match_phrase_prefix: { content: query } },
      { match_phrase_prefix: { text: query } },
    ];

    const [users, posts, comments] = await Promise.all([
      this.es.search({
        index: 'users',
        size: 10,
        query: { bool: { should } },
      }),
      this.es.search({
        index: 'posts',
        size: 10,
        query: { bool: { should } },
      }),
      this.es.search({
        index: 'comments',
        size: 10,
        query: { bool: { should } },
      }),
    ]);

    return {
      users: users.hits.hits.map((h) => h._source),
      posts: posts.hits.hits.map((h) => h._source),
      comments: comments.hits.hits.map((h) => h._source),
    };
  }
}
