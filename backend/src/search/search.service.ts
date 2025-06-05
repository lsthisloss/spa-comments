import { SearchHit } from '@elastic/elasticsearch/lib/api/types';
import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  UserSearchResult,
  PostSearchResult,
  CommentSearchResult,
  SearchResponse,
  PostIndexInput,
  CommentIndexInput,
  AuthorIndexInput,
  PostContextInput,
} from './types/search-result.types';
interface ElasticsearchError {
  meta?: {
    statusCode?: number;
    body?: any;
  };
  message?: string;
}

// Функция для проверки является ли ошибка ошибкой Elasticsearch
function isElasticsearchError(error: unknown): error is ElasticsearchError {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  const errorObj = error as Record<string, unknown>;

  return (
    'meta' in errorObj &&
    errorObj.meta !== null &&
    typeof errorObj.meta === 'object'
  );
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private indicesEnsured = false;
  private isHealthy = false;

  constructor(private readonly es: ElasticsearchService) {
    void this.ensureIndicesWithRetry();
    this.logger.log('Initializing SearchService...');
    void this.debugSearchIndices();
  }

  // Метод для инициализации индексов с повторными попытками
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
    } catch (error: unknown) {
      this.isHealthy = false;
      this.logger.warn(
        'Elasticsearch health check failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return false;
    }
  }

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
      } catch (error: unknown) {
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
              id: { type: 'keyword' },
              userName: {
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: { type: 'keyword' },
                  suggest: { type: 'completion' },
                },
              },
              email: {
                type: 'text',
                analyzer: 'standard',
                fields: { keyword: { type: 'keyword' } },
              },
              slug: { type: 'keyword' },
              avatarUrl: { type: 'text', index: false },
              avatarShape: { type: 'keyword' },
              role: { type: 'keyword' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        },
      },
      {
        name: 'posts',
        mapping: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              content: {
                type: 'text',
                analyzer: 'standard',
                fields: { keyword: { type: 'keyword' } },
              },
              slug: { type: 'keyword' },
              likes: { type: 'integer' },
              repliesCount: { type: 'integer' },
              imageUrl: { type: 'text', index: false },
              fileUrl: { type: 'text', index: false },
              fileName: { type: 'text' },
              fileType: { type: 'keyword' },
              userId: { type: 'keyword' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
              author: {
                properties: {
                  id: { type: 'keyword' },
                  userName: {
                    type: 'text',
                    fields: { keyword: { type: 'keyword' } },
                  },
                  avatarUrl: { type: 'text', index: false },
                  avatarShape: { type: 'keyword' },
                  slug: { type: 'keyword' },
                  email: { type: 'text', index: false },
                  role: { type: 'keyword' },
                },
              },
            },
          },
        },
      },
      {
        name: 'comments',
        mapping: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              content: {
                type: 'text',
                analyzer: 'standard',
                fields: { keyword: { type: 'keyword' } },
              },
              slug: { type: 'keyword' },
              likes: { type: 'integer' },
              repliesCount: { type: 'integer' },
              imageUrl: { type: 'text', index: false },
              fileUrl: { type: 'text', index: false },
              fileName: { type: 'text' },
              fileType: { type: 'keyword' },
              userId: { type: 'keyword' },
              postId: { type: 'keyword' },
              parentId: { type: 'keyword' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
              author: {
                properties: {
                  id: { type: 'keyword' },
                  userName: {
                    type: 'text',
                    fields: { keyword: { type: 'keyword' } },
                  },
                  avatarUrl: { type: 'text', index: false },
                  avatarShape: { type: 'keyword' },
                  slug: { type: 'keyword' },
                  email: { type: 'text', index: false },
                  role: { type: 'keyword' },
                },
              },
              // Данные о посте для контекста
              post: {
                properties: {
                  id: { type: 'keyword' },
                  slug: { type: 'keyword' },
                  content: { type: 'text', index: false },
                },
              },
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
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Error ensuring index ${idx.name}: ${errorMessage}`);
        throw error;
      }
    }
  }

  async searchAll(query: string): Promise<SearchResponse> {
    if (!query || query.length < 1) {
      return { users: [], posts: [], comments: [] };
    }

    if (!this.indicesEnsured || !this.isHealthy) {
      this.logger.warn('Elasticsearch not ready, returning empty results');
      return { users: [], posts: [], comments: [] };
    }

    try {
      // Поиск пользователей
      const userQuery = {
        bool: {
          should: [
            { match_phrase_prefix: { userName: query } },
            { match_phrase_prefix: { email: query } },
            { wildcard: { userName: `*${query.toLowerCase()}*` } },
            { wildcard: { email: `*${query.toLowerCase()}*` } },
          ],
          minimum_should_match: 1,
        },
      };

      // Поиск постов
      const postQuery = {
        bool: {
          should: [
            { match_phrase_prefix: { content: query } },
            { match: { content: { query, boost: 2.0 } } },
            { wildcard: { content: `*${query.toLowerCase()}*` } },
            { match: { 'author.userName': query } },
            { match: { fileName: query } },
          ],
          minimum_should_match: 1,
        },
      };

      // Поиск комментариев
      const commentQuery = {
        bool: {
          should: [
            { match_phrase_prefix: { content: query } },
            { match: { content: { query, boost: 2.0 } } },
            { wildcard: { content: `*${query.toLowerCase()}*` } },
            { match: { 'author.userName': query } },
            { match: { fileName: query } },
          ],
          minimum_should_match: 1,
        },
      };

      const [users, posts, comments] = await Promise.all([
        this.searchIndex('users', userQuery),
        this.searchIndex('posts', postQuery),
        this.searchIndex('comments', commentQuery),
      ]);

      // ТИПИЗИРОВАННАЯ обработка результатов
      const processedUsers = users.hits.hits.map((h: SearchHit) => {
        const source = h._source as UserSearchResult;
        return {
          id: source?.id || '',
          userName: source?.userName || '',
          email: source?.email || '',
          avatarUrl: source?.avatarUrl,
          avatarShape: source?.avatarShape,
          slug: source?.slug || '',
          role: source?.role || '',
          createdAt: source?.createdAt || new Date(),
          updatedAt: source?.updatedAt || new Date(),
          _score: h._score === null ? undefined : h._score,
          type: 'user' as const,
        };
      });

      const processedPosts = posts.hits.hits.map((h: SearchHit) => {
        const source = h._source as PostSearchResult;
        return {
          id: source?.id || '',
          content: source?.content || '',
          slug: source?.slug || '',
          likes: source?.likes || 0,
          repliesCount: source?.repliesCount || 0,
          imageUrl: source?.imageUrl,
          fileUrl: source?.fileUrl,
          fileName: source?.fileName,
          fileType: source?.fileType,
          userId: source?.userId || '',
          createdAt: source?.createdAt || new Date(),
          updatedAt: source?.updatedAt || new Date(),
          author: source?.author || {
            id: '',
            userName: '',
            slug: '',
            email: '',
            role: '',
          },
          _score: h._score === null ? undefined : h._score,
          type: 'post' as const,
        };
      });

      const processedComments = comments.hits.hits.map((h: SearchHit) => {
        const source = h._source as CommentSearchResult;
        return {
          id: source?.id || '',
          content: source?.content || '',
          slug: source?.slug || '',
          likes: source?.likes || 0,
          repliesCount: source?.repliesCount || 0,
          imageUrl: source?.imageUrl,
          fileUrl: source?.fileUrl,
          fileName: source?.fileName,
          fileType: source?.fileType,
          userId: source?.userId || '',
          postId: source?.postId || '',
          parentId: source?.parentId,
          createdAt: source?.createdAt || new Date(),
          updatedAt: source?.updatedAt || new Date(),
          author: source?.author || {
            id: '',
            userName: '',
            slug: '',
            email: '',
            role: '',
          },
          post: source?.post,
          _score: h._score === null ? undefined : h._score,
          type: 'comment' as const,
        };
      });

      this.logger.log(
        `Search results for "${query}": ${processedUsers.length} users, ${processedPosts.length} posts, ${processedComments.length} comments`,
      );

      return {
        users: processedUsers,
        posts: processedPosts,
        comments: processedComments,
      };
    } catch (error: unknown) {
      this.logger.error('Search failed:', error);
      return { users: [], posts: [], comments: [] };
    }
  }

  /**
   * ТИПИЗИРОВАННЫЙ поиск в конкретном индексе
   */
  private async searchIndex(index: string, query: Record<string, unknown>) {
    try {
      return await this.es.search({
        index,
        size: 20,
        query,
        sort: [
          { _score: { order: 'desc' } },
          { createdAt: { order: 'desc', unmapped_type: 'date' } },
        ],
      });
    } catch (error: unknown) {
      this.logger.warn(`Search failed for index ${index}:`, error);
      return { hits: { hits: [] } };
    }
  }
  async indexUser(user: UserSearchResult): Promise<void> {
    if (!this.indicesEnsured || !this.isHealthy) {
      this.logger.warn('Elasticsearch not ready, skipping user indexing');
      return;
    }

    try {
      await this.es.index({
        index: 'users',
        id: user.id,
        document: {
          id: user.id,
          userName: user.userName,
          email: user.email,
          slug: user.slug,
          avatarUrl: user.avatarUrl,
          avatarShape: user.avatarShape,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
      this.logger.log(`Indexed user: ${user.userName} (${user.id})`);
    } catch (error: unknown) {
      this.logger.error(`Failed to index user ${user.id}:`, error);
    }
  }

  async indexPost(
    post: PostIndexInput,
    author: AuthorIndexInput,
  ): Promise<void> {
    this.logger.log(
      `🔍 Attempting to index post ${post.id}. Elasticsearch ready: ${this.indicesEnsured && this.isHealthy}`,
    );

    if (!this.indicesEnsured || !this.isHealthy) {
      this.logger.warn('❌ Elasticsearch not ready, skipping post indexing');
      this.logger.warn(
        `Indices ensured: ${this.indicesEnsured}, Healthy: ${this.isHealthy}`,
      );
      return;
    }

    try {
      const postData: PostSearchResult = {
        id: post.id,
        content: post.content,
        slug: post.slug,
        likes: Number(post.likes) || 0,
        repliesCount: Number(post.repliesCount) || 0,
        imageUrl: post.imageUrl,
        fileUrl: post.fileUrl,
        fileName: post.fileName,
        fileType: post.fileType,
        userId: post.userId,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: {
          id: author.id,
          userName: author.userName,
          avatarUrl: author.avatarUrl,
          avatarShape: author.avatarShape,
          slug: author.slug,
          email: author.email,
          role: author.role,
        },
      };

      this.logger.log(
        `📝 Indexing post data:`,
        JSON.stringify(postData, null, 2),
      );

      await this.es.index({
        index: 'posts',
        id: post.id,
        document: postData,
      });

      this.logger.log(`✅ Post successfully indexed: ${post.id}`);
    } catch (error: unknown) {
      this.logger.error(`❌ Failed to index post ${post.id}:`, error);
    }
  }
  async debugSearchIndices(): Promise<void> {
    try {
      const [usersCount, postsCount, commentsCount] = await Promise.all([
        this.es.count({ index: 'users' }),
        this.es.count({ index: 'posts' }),
        this.es.count({ index: 'comments' }),
      ]);

      this.logger.log(
        `📊 Index counts - Users: ${usersCount.count}, Posts: ${postsCount.count}, Comments: ${commentsCount.count}`,
      );
    } catch (error) {
      this.logger.error('Failed to get index counts:', error);
    }
  }
  async indexComment(
    comment: CommentIndexInput,
    author: AuthorIndexInput,
    post?: PostContextInput,
  ): Promise<void> {
    if (!this.indicesEnsured || !this.isHealthy) {
      this.logger.warn('Elasticsearch not ready, skipping comment indexing');
      return;
    }

    try {
      const commentData: CommentSearchResult = {
        id: comment.id,
        content: comment.content,
        slug: comment.slug,
        likes: Number(comment.likes) || 0,
        repliesCount: Number(comment.repliesCount) || 0,
        imageUrl: comment.imageUrl,
        fileUrl: comment.fileUrl,
        fileName: comment.fileName,
        fileType: comment.fileType,
        userId: comment.userId,
        postId: comment.postId,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: {
          id: author.id,
          userName: author.userName,
          avatarUrl: author.avatarUrl,
          avatarShape: author.avatarShape,
          slug: author.slug,
          email: author.email,
          role: author.role,
        },
        post: post
          ? {
              id: post.id,
              slug: post.slug,
              content: post.content.substring(0, 200),
            }
          : undefined,
      };

      await this.es.index({
        index: 'comments',
        id: comment.id,
        document: commentData,
      });
      this.logger.log(`Indexed comment: ${comment.id}`);
    } catch (error: unknown) {
      this.logger.error(`Failed to index comment ${comment.id}:`, error);
    }
  }
  // Метод для проверки готовности поиска
  isSearchReady(): Promise<boolean> {
    return Promise.resolve(this.indicesEnsured && this.isHealthy);
  }

  async deleteComment(commentId: string): Promise<void> {
    if (!this.indicesEnsured || !this.isHealthy) {
      this.logger.warn('Elasticsearch not ready, skipping comment deletion');
      return;
    }

    try {
      await this.es.delete({
        index: 'comments',
        id: commentId,
      });
      this.logger.log(`Deleted comment from index: ${commentId}`);
    } catch (error: unknown) {
      if (isElasticsearchError(error) && error.meta?.statusCode === 404) {
        this.logger.warn(
          `Comment ${commentId} not found in Elasticsearch index`,
        );
      } else {
        this.logger.error(`Failed to delete comment ${commentId}:`, error);
      }
    }
  }

  async deletePost(postId: string): Promise<void> {
    if (!this.indicesEnsured || !this.isHealthy) {
      this.logger.warn('Elasticsearch not ready, skipping post deletion');
      return;
    }

    try {
      await this.es.delete({
        index: 'posts',
        id: postId,
      });
      this.logger.log(`Deleted post from index: ${postId}`);
    } catch (error: unknown) {
      if (isElasticsearchError(error) && error.meta?.statusCode === 404) {
        this.logger.warn(`Post ${postId} not found in Elasticsearch index`);
      } else {
        this.logger.error(`Failed to delete post ${postId}:`, error);
      }
    }
  }

  async deleteUser(userId: string): Promise<void> {
    if (!this.indicesEnsured || !this.isHealthy) {
      this.logger.warn('Elasticsearch not ready, skipping user deletion');
      return;
    }

    try {
      await this.es.delete({
        index: 'users',
        id: userId,
      });
      this.logger.log(`Deleted user from index: ${userId}`);
    } catch (error: unknown) {
      if (isElasticsearchError(error) && error.meta?.statusCode === 404) {
        this.logger.warn(`User ${userId} not found in Elasticsearch index`);
      } else {
        this.logger.error(`Failed to delete user ${userId}:`, error);
      }
    }
  }
}
