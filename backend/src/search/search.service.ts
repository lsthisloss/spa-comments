import { SearchHit } from '@elastic/elasticsearch/lib/api/types';
import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private indicesEnsured = false;
  private isHealthy = false;

  constructor(private readonly es: ElasticsearchService) {
    void this.ensureIndicesWithRetry();
  }
  // Метод для инициализации индексов с повторными попытками
  private async ensureIndicesWithRetry(maxRetries = 15, delay = 5000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.checkHealth();
        if (!this.isHealthy) {
          throw new Error('Elasticsearch is not healthy');
        }

        await this.ensureIndices();
        this.indicesEnsured = true;
        this.logger.log('Successfully ensured Elasticsearch indices');
        return;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Attempt ${attempt}/${maxRetries} failed to ensure indices: ${errorMessage}`,
        );

        if (attempt === maxRetries) {
          this.logger.error(
            'Failed to ensure indices after all retries. Search functionality will be disabled.',
          );
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  // Метод для проверки состояния Elasticsearch
  private async checkHealth(): Promise<boolean> {
    try {
      const health = await this.es.cluster.health({ timeout: '10s' });
      this.isHealthy = health.status === 'green' || health.status === 'yellow';
      if (this.isHealthy) {
        this.logger.log('Elasticsearch is healthy');
      } else {
        this.logger.warn(`Elasticsearch health status: ${health.status}`);
      }
      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
      this.logger.warn(
        'Elasticsearch health check failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return false;
    }
  }
  // Метод для создания индексов, если они не существуют
  // Этот метод вызывается внутри ensureIndicesWithRetry
  // и должен быть устойчив к ошибкам, чтобы не блокировать инициализацию
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
          this.logger.log(`Created index: ${idx.name}`);
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        this.logger.error(`Error ensuring index ${idx.name}: ${errorMessage}`);
        throw e; // Тут выбрасываем ошибку, чтобы retry мог повторить попытку
      }
    }
  }
  // Метод для поиска по всем индексам
  // Возвращает пользователей, посты и комментарии, соответствующие запросу
  // Если индексы не готовы или Elasticsearch не здоров, возвращает пустые массивы
  async searchAll(query: string) {
    if (!query || query.length < 1) {
      return { users: [], posts: [], comments: [] };
    }

    if (!this.indicesEnsured || !this.isHealthy) {
      this.logger.warn('Elasticsearch not ready, returning empty results');
      return { users: [], posts: [], comments: [] };
    }

    try {
      const should = [
        { match_phrase_prefix: { userName: query } },
        { match_phrase_prefix: { email: query } },
        { match_phrase_prefix: { title: query } },
        { match_phrase_prefix: { content: query } },
        { match_phrase_prefix: { text: query } },
      ];

      const [users, posts, comments] = await Promise.all([
        this.searchIndex('users', should),
        this.searchIndex('posts', should),
        this.searchIndex('comments', should),
      ]);

      return {
        users: users.hits.hits.map(
          (
            h: SearchHit<{
              userName: string;
              email: string;
              avatarUrl: string;
            }>,
          ) => h._source,
        ),
        posts: posts.hits.hits.map(
          (
            h: SearchHit<{
              title: string;
              content: string;
              author: object;
            }>,
          ) => h._source,
        ),
        comments: comments.hits.hits.map(
          (
            h: SearchHit<{
              text: string;
              author: object;
            }>,
          ) => h._source,
        ),
      };
    } catch (error) {
      this.logger.error('Search failed:', error);
      return { users: [], posts: [], comments: [] };
    }
  }
  // Метод для поиска в конкретном индексе
  // Используется внутри searchAll для поиска по всем индексам
  private async searchIndex(index: string, should: any[]) {
    try {
      return await this.es.search({
        index,
        size: 10,
        query: { bool: { should } },
      });
    } catch (error) {
      this.logger.warn(`Search failed for index ${index}:`, error);
      return { hits: { hits: [] } };
    }
  }

  // Метод для проверки готовности поиска
  isSearchReady(): Promise<boolean> {
    return Promise.resolve(this.indicesEnsured && this.isHealthy);
  }

  // Метод для принудительной переинициализации
  async reinitialize(): Promise<void> {
    this.indicesEnsured = false;
    this.isHealthy = false;
    await this.ensureIndicesWithRetry();
  }
}
