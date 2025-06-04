import { makeObservable, observable, action, runInAction, IObservableArray, reaction } from "mobx";
import { BaseStore } from "./BaseStore";
import {
  Post, User, PostsSocketResponse,
  FetchPostResponse, NestedPostsSocketResponse,
  SocketResponseVariant, SocketEventData
} from "../../types/interfaces";
import { logger } from "../../utils/Logger";
import io from "socket.io-client";
import type SocketStore from "./SocketStore";
import type UserStore from "./UserStore";
import type CommentStore from "./CommentStore";
import { IPostStore } from "../../types/stores";
import { FeedType } from "../../types/enums";

const POSTS_PER_PAGE = 25;

/**
 * Типы лент постов
 */

/**
 * Состояние одной ленты
 */
interface FeedState {
  list: IObservableArray<Post>;
  allLoaded: boolean;
  loading: boolean;
  page: number;
  total: number;
  buffer: Post[];
  manualUpdateMode: boolean;
  newPostsCount: number;
  latestPost: Post | null;
  error: Error | null;
  reset: boolean;
  userId?: string;
}

/**
 * Хранилище для управления постами
 */
class PostStore extends BaseStore<Post> implements IPostStore {
  // Инъектированные сторы
  private socketStore: SocketStore;
  private userStore: UserStore;
  private commentStore: CommentStore;

  // Состояния лент
  feeds: Record<FeedType, FeedState> = {
    feed: {
      list: observable.array<Post>([]),
      allLoaded: false,
      loading: false,
      page: 1,
      total: 0,
      buffer: [],
      manualUpdateMode: false,
      newPostsCount: 0,
      latestPost: null,
      error: null,
      reset: false,
    },
    following: {
      list: observable.array<Post>([]),
      allLoaded: false,
      loading: false,
      page: 1,
      total: 0,
      buffer: [],
      manualUpdateMode: false,
      newPostsCount: 0,
      latestPost: null,
      error: null,
      reset: false,
    },
    user: {
      list: observable.array<Post>([]),
      allLoaded: false,
      loading: false,
      page: 1,
      total: 0,
      buffer: [],
      manualUpdateMode: false,
      newPostsCount: 0,
      latestPost: null,
      error: null,
      reset: false,
      userId: undefined,
    }
  };

  postsMap = observable.map<string, Post>();
  private fetchPostPromises = new Map<string, Promise<Post | null>>();

  // Состояние для сохранения feed (только для главной ленты)
  feedScrollPosition = 0;
  feedSavedPage = 1;
  feedSavedPosts = observable.array<Post>([]);
  isFeedStateRestored = false;

  // Таймеры
  intervals: Record<FeedType, NodeJS.Timeout | null> = {
    feed: null,
    following: null,
    user: null
  };
  scrollHandler?: (this: Window, ev: Event) => void;

  constructor(socketStore: SocketStore, userStore: UserStore, commentStore: CommentStore) {
    super();

    // Сохраняем инъектированные сторы
    this.socketStore = socketStore;
    this.userStore = userStore;
    this.commentStore = commentStore;

    makeObservable(this, {
      feeds: observable,
      feedScrollPosition: observable,
      feedSavedPage: observable,
      feedSavedPosts: observable,
      isFeedStateRestored: observable,

      // Actions
      toggleLike: action,
      loadCommentsToPost: action,
      setupSocketListeners: action,
      getFeed: action,
      fetchPosts: action,
      loadMore: action,
      resetFeedState: action,
      setManualUpdateMode: action,
      handleLoadNewPosts: action,
      addPost: action,
      handleNewPost: action,
      saveFeedState: action,
      restoreFeedState: action,
      onBackToFeed: action,
      startTrackingScroll: action,
      stopTrackingScroll: action,
      fetchPostBySlug: action,
      addPostToAllFeeds: action,
      clearResetFlag: action,
      updatePostCommentCount: action,
      updatePostCommentCountBySlug: action,
      processPosts: action,
      markFeedForRefresh: action,
      getUserFeedState: action,
      switchToUser: action,
    });

    logger.log("[PostStore] Initialized");
    this.setupSocketListeners();
  }

  // Реализация IPostStore
  get feedList(): Post[] {
    return this.feeds.feed.list;
  }

  get feedLoading(): boolean {
    return this.feeds.feed.loading;
  }

  get feedAllLoaded(): boolean {
    return this.feeds.feed.allLoaded;
  }

  get feedTotal(): number {
    return this.feeds.feed.total;
  }

  get hasFeedItems(): boolean {
    return this.feeds.feed.list.length > 0;
  }

  get hasFollowingItems(): boolean {
    return this.feeds.following.list.length > 0;
  }

  async fetchUserPosts(userId: string, page = 1): Promise<void> {
    // Check if we already have this user's posts cached and not forcing a reset
    if (page === 1 &&
      this.feeds.user.list.length > 0 &&
      this.feeds.user.userId === userId &&
      !this.feeds.user.reset) {
      logger.log(`[PostStore] Using cached user posts for ${userId} (${this.feeds.user.list.length} posts)`);
      return Promise.resolve();
    }

    return this.fetchPosts("user", page, userId);
  }

  async fetchFollowingPosts(page = 1): Promise<void> {
    // If we already have enough data and not forcing a refresh, use the cached data
    if (page === 1 && this.feeds.following.list.length > 0 && !this.feeds.following.reset) {
      logger.log(`[PostStore] Using cached following data (${this.feeds.following.list.length} posts)`);
      return Promise.resolve();
    }

    return this.fetchPosts("following", page);
  }

  async fetchFeedPosts(page = 1): Promise<void> {
    // If we already have enough data and not forcing a refresh, use the cached data
    if (page === 1 && this.feeds.feed.list.length > 0 && !this.feeds.feed.reset) {
      logger.log(`[PostStore] Using cached feed data (${this.feeds.feed.list.length} posts)`);
      return Promise.resolve();
    }

    return this.fetchPosts("feed", page);
  }

  loadMoreFeedPosts(): void {
    this.loadMore("feed");
  }

  resetFeedState(): void {
    this.resetFeedsState("feed");
  }

  getPostById(postId: string): Post | undefined {
    return this.getItemById(postId);
  }

  /**
   * Универсальный метод получения ленты
   */
  getFeed(type: FeedType): FeedState {
    return this.feeds[type];
  }


  updatePostCommentCount = action((postId: string, count: number) => {
    logger.log(`[PostStore] updatePostCommentCount called with postId=${postId}, count=${count}`);

    // First, update in the postsMap (primary source)
    const mappedPost = this.postsMap.get(postId);
    if (mappedPost) {
      const oldCount = mappedPost.commentCount || 0;
      logger.log(`[PostStore] Updating comment count for post ${postId} in postsMap from ${oldCount} to ${count}`);
      mappedPost.commentCount = count;

      // Check if feeds share the same references
      const updatedFeeds: string[] = [];
      Object.entries(this.feeds).forEach(([feedType, feed]) => {
        const feedPost = feed.list.find(p => p.id === postId);
        if (feedPost) {
          if (feedPost === mappedPost) {
            logger.log(`[PostStore] Feed ${feedType} shares reference with postsMap - auto-updated to ${count}`);
          } else {
            // This shouldn't happen with our fixed approach, but update manually if needed
            logger.warn(`[PostStore] Feed ${feedType} has different reference, updating manually from ${feedPost.commentCount || 0} to ${count}`);
            feedPost.commentCount = count;
          }
          updatedFeeds.push(feedType);
        }
      });

      logger.log(`[PostStore] Updated comment count in feeds: ${updatedFeeds.join(', ') || 'none'}`);
    } else {
      logger.warn(`[PostStore] Post ${postId} not found in postsMap, updating feeds directly`);

      // Fallback: update in feeds directly
      const updatedFeeds: string[] = [];
      Object.entries(this.feeds).forEach(([feedType, feed]) => {
        const post = feed.list.find(p => p.id === postId);
        if (post) {
          const oldCount = post.commentCount || 0;
          logger.log(`[PostStore] Updating comment count for post ${postId} in feed ${feedType} from ${oldCount} to ${count}`);
          post.commentCount = count;
          updatedFeeds.push(feedType);
        }
      });

      logger.log(`[PostStore] Updated comment count in feeds: ${updatedFeeds.join(', ') || 'none'}`);
    }

    // Also update in buffer and saved posts (existing code)
    Object.entries(this.feeds).forEach(([feedType, feed]) => {
      const bufferPost = feed.buffer.find(p => p.id === postId);
      if (bufferPost) {
        const oldCount = bufferPost.commentCount || 0;
        logger.log(`[PostStore] Updating comment count for post ${postId} in ${feedType} buffer from ${oldCount} to ${count}`);
        bufferPost.commentCount = count;
      }
    });

    const savedPost = this.feedSavedPosts.find(p => p.id === postId);
    if (savedPost) {
      const oldCount = savedPost.commentCount || 0;
      logger.log(`[PostStore] Updating comment count for post ${postId} in saved feed posts from ${oldCount} to ${count}`);
      savedPost.commentCount = count;
    }
  });

  updatePostCommentCountBySlug = action((postSlug: string, count: number) => {
    const post = this.getPostBySlug(postSlug);
    if (!post) return;

    this.updatePostCommentCount(post.id, count);
  });

  /**
   * Socket запрос с правильной обработкой ответа
   */
  private emitSocketRequest(eventName: string, eventData: SocketEventData): Promise<{ posts: Post[], total: number, isEmpty?: boolean, allLoaded?: boolean, message?: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Request timeout"));
      }, 15000);

      this.socketStore.posts!.emit(eventName, eventData, (response: SocketResponseVariant) => {
        clearTimeout(timeout);

        logger.log(`[PostStore] Socket response for ${eventName}:`, response);

        // Проверяем на ошибку
        if (response && typeof response === 'object' && 'error' in response && response.error) {
          reject(new Error(response.error));
          return;
        }

        let posts: Post[] = [];
        let total: number = 0;
        let isEmpty: boolean | undefined = undefined;
        let allLoaded: boolean | undefined = undefined;
        let message: string | undefined = undefined;

        // Обработка разных форматов ответа
        if (Array.isArray(response)) {
          posts = response;
          total = response.length;
        } else if (response && typeof response === 'object') {
          // Объект с полями posts и total
          const objectResponse = response as PostsSocketResponse | NestedPostsSocketResponse;

          // Извлекаем дополнительные поля
          if ('isEmpty' in objectResponse) {
            isEmpty = objectResponse.isEmpty;
          }
          if ('allLoaded' in objectResponse) {
            allLoaded = objectResponse.allLoaded;
          }
          if ('message' in objectResponse) {
            message = objectResponse.message;
          }

          if ('posts' in objectResponse && objectResponse.posts) {
            if (Array.isArray(objectResponse.posts)) {
              // Формат: { posts: Post[], total?: number }
              posts = objectResponse.posts;
              total = objectResponse.total || 0;
            } else if (typeof objectResponse.posts === 'object' && 'posts' in objectResponse.posts) {
              // Формат: { posts: { posts: Post[], total: number } }
              const nestedPosts = objectResponse.posts as { posts: Post[]; total: number };
              posts = nestedPosts.posts || [];
              total = nestedPosts.total || objectResponse.total || 0;
            }
          }

          // Дополнительная проверка на total
          if (total === 0 && 'total' in objectResponse && typeof objectResponse.total === 'number') {
            total = objectResponse.total;
          }
        } else {
          logger.warn("Unexpected response format:", response);
          posts = [];
          total = 0;
        }

        logger.log(`[PostStore] Processed ${eventName} response:`, { postsCount: posts.length, total, isEmpty, allLoaded });
        resolve({ posts, total, isEmpty, allLoaded, message });
      });
    });
  }

  /**
   * Конфигурация socket событий
   */
  private getSocketEventConfig(feedType: FeedType, targetUserId?: string, page = 1) {
    const limit = POSTS_PER_PAGE;

    if (targetUserId) {
      return {
        eventName: "fetchUserPosts",
        eventData: { userId: targetUserId, page, limit }
      };
    }

    if (feedType === "following") {
      return {
        eventName: "fetchFollowingPosts",
        eventData: { page, limit }
      };
    }

    return {
      eventName: "fetchPosts",
      eventData: { page, limit }
    };
  }

  /**
   * Загрузка постов
   */

  fetchPosts = action(async (type: FeedType, page: number = 1, userId?: string) => {
    const feed = type === "user" ? this.getUserFeedState() : this.getFeed(type);

    // Защита от двойной загрузки
    if (feed.loading) {
      logger.log(`[PostStore] Skipping fetchPosts: already loading ${type}`);
      return;
    }

    if (feed.allLoaded && page > 1) {
      logger.log(`[PostStore] Skipping fetchPosts: all ${type} posts already loaded`);
      return;
    }

    const userParam = userId ? userId : "none";
    logger.log(`[PostStore] Fetching posts: type=${type}, page=${page}, user=${userParam}`);

    runInAction(() => {
      feed.loading = true;
      feed.error = null;
    });

    // Проверяем готовность сокета и ждем его подключения если нужно
    if (!this.socketStore.posts?.connected) {
      logger.log(`[PostStore] Socket not connected, waiting for connection...`);

      // Ждем подключения сокета до 10 секунд
      let waitAttempts = 0;
      const maxAttempts = 20; // 20 попыток по 500мс = 10 секунд

      while (!this.socketStore.posts?.connected && waitAttempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waitAttempts++;
        logger.log(`[PostStore] Waiting for socket... attempt ${waitAttempts}/${maxAttempts}`);
      }

      if (!this.socketStore.posts?.connected) {
        logger.error(`[PostStore] Socket failed to connect after ${waitAttempts} attempts`);
        runInAction(() => {
          feed.loading = false;
          feed.error = new Error("Failed to connect to socket");
        });
        return;
      }

      logger.log(`[PostStore] Socket connected after ${waitAttempts} attempts, proceeding with fetch`);
    }

    // Подготовка параметров запроса
    const { eventName, eventData } = this.getSocketEventConfig(type, userId, page);

    try {
      const result = await this.emitSocketRequest(eventName, eventData);

      logger.log(`[PostStore] Socket response for ${eventName}:`, result);
      logger.log(`[PostStore] Processed ${eventName} response:`, {
        postsCount: result.posts.length,
        total: result.total,
        isEmpty: result.isEmpty,
        allLoaded: result.allLoaded
      });

      logger.log(`[PostStore] Received ${result.posts.length} posts, total: ${result.total}`);

      runInAction(() => {
        // СНАЧАЛА обрабатываем и добавляем в postsMap
        this.processPosts(result.posts);

        // ЗАТЕМ получаем ссылки из postsMap для feeds
        const postsToAdd: Post[] = [];

        result.posts.forEach(post => {
          const mappedPost = this.postsMap.get(post.id);
          if (mappedPost) {
            postsToAdd.push(mappedPost);
            //logger.log(`[PostStore] Using shared reference for post ${post.id}`);
          } else {
            // КРИТИКАЛ случай - Этого не должно происходить, но если происходит - создаем observable и добавляем в map
            logger.warn(`[PostStore] Post ${post.id} not found in postsMap, creating new observable`);
            const observablePost = observable(post);
            this.postsMap.set(post.id, observablePost);
            postsToAdd.push(observablePost);
          }
        });

        // Проверяем что все посты имеют правильные ссылки
        logger.log(`[PostStore] Adding ${postsToAdd.length} posts to ${type} feed with shared references`);

        if (page === 1) {
          // Заменяем весь список для первой страницы
          feed.list.replace(postsToAdd);
          feed.page = 1;
        } else {
          // Добавляем к существующему списку для следующих страниц
          feed.list.push(...postsToAdd);
          feed.page = page;
        }

        feed.total = result.total;
        feed.allLoaded = result.allLoaded || result.posts.length < POSTS_PER_PAGE;
        feed.loading = false;
        feed.error = null;
        feed.reset = false;

        logger.log(`[PostStore] Updated ${type} feed: ${feed.list.length} total posts`);

        // Проверяем ссылки после добавления
        if (postsToAdd.length > 0) {
          const firstPost = postsToAdd[0];
          const firstFeedPost = feed.list[page === 1 ? 0 : feed.list.length - postsToAdd.length];
          const firstMappedPost = this.postsMap.get(firstPost.id);

          logger.log(`[PostStore] Reference check for post ${firstPost.id}:`);
          logger.log(`  - postsMap reference: ${firstMappedPost === firstPost}`);
          logger.log(`  - feed reference: ${firstFeedPost === firstPost}`);
          logger.log(`  - all same: ${firstMappedPost === firstPost && firstFeedPost === firstPost}`);
        }
      });
    } catch (error) {
      runInAction(() => {
        feed.loading = false;
        feed.error = error as Error;
        logger.error(`[PostStore] Error fetching ${type} posts:`, error);
      });
    }
  });

  getUserFeedState(): FeedState {
    return this.feeds.user;
  }
  switchToUser = action((userId: string) => {
    const userFeed = this.feeds.user;

    // Если тот же пользователь - ничего не делаем
    if (userFeed.userId === userId) {
      return;
    }

    logger.log(`[PostStore] Switching user feed from ${userFeed.userId} to ${userId}`);

    // Сбрасываем состояние
    userFeed.list.clear();
    userFeed.allLoaded = false;
    userFeed.loading = false;
    userFeed.page = 1;
    userFeed.total = 0;
    userFeed.buffer = [];
    userFeed.manualUpdateMode = false;
    userFeed.newPostsCount = 0;
    userFeed.latestPost = null;
    userFeed.error = null;
    userFeed.reset = true;
    userFeed.userId = userId;
  });
  loadMore = action((feedType: FeedType, targetUserId?: string) => {
    const feed = targetUserId ? this.getUserFeedState() : this.getFeed(feedType);

    if (feed.loading || feed.allLoaded) {
      logger.log(`[PostStore] Skipping loadMore: loading=${feed.loading}, allLoaded=${feed.allLoaded}`);
      return;
    }

    const nextPage = feed.page + 1;
    logger.log(`[PostStore] Loading more ${feedType} posts, page ${nextPage}`);

    this.fetchPosts(feedType, nextPage, targetUserId);
  });

  resetFeedsState = action((type: FeedType = "feed", userId?: string) => {
    let feed: FeedState;

    if (type === "user" && userId) {
      feed = this.getUserFeedState();
    } else {
      feed = this.getFeed(type);
    }

    logger.log(`[PostStore] Resetting ${type} state${userId ? ` for user ${userId}` : ''}`);

    runInAction(() => {
      feed.list.clear();
      feed.allLoaded = false;
      feed.loading = false;
      feed.page = 1;
      feed.total = 0;
      feed.buffer = [];
      feed.manualUpdateMode = false;
      feed.newPostsCount = 0;
      feed.latestPost = null;
      feed.error = null;
      feed.reset = true;
      if (userId && type === "user") {
        feed.userId = userId;
      }
    });
  });

  clearResetFlag = action((feedType: FeedType, userId?: string) => {
    let feed: FeedState;

    if (feedType === "user" && userId) {
      feed = this.getUserFeedState();
    } else {
      feed = this.getFeed(feedType);
    }

    runInAction(() => {
      feed.reset = false;
    });

    logger.log(`[PostStore] Cleared reset flag for ${feedType} feed${userId ? ` (user: ${userId})` : ''}`);
  });

  handleNewPost = action((post: Post, type: FeedType) => {
    if (!post.createdAt) {
      post.createdAt = new Date().toISOString();
    }

    const observablePost = observable(post);
    this.postsMap.set(post.id, observablePost);

    const feed = this.getFeed(type);

    // Проверяем дубликаты
    const existsInList = feed.list.some(p => p.id === post.id);
    const existsInBuffer = feed.buffer.some(p => p.id === post.id);

    if (existsInList || existsInBuffer) {
      logger.log(`[PostStore] Post ${post.id} already exists in ${type}, skipping`);
      return;
    }

    const isSpam = feed.buffer.length >= 5;
    const isCurrentUserPost = post.userId === this.userStore.user?.id;

    runInAction(() => {
      if (isCurrentUserPost) {
        feed.list.unshift(observablePost);
        logger.log(`[PostStore] Current user post ${post.id} added directly to ${type} feed`);

        // Добавляем в ленту пользователя
        const userFeed = this.getUserFeedState();
        if (userFeed.userId === post.userId && !userFeed.list.some(p => p.id === post.id)) {
          userFeed.list.unshift(observablePost);
          userFeed.total += 1;
          logger.log(`[PostStore] Also added user post ${post.id} to user feed`);
        }
      } else if (isSpam || feed.manualUpdateMode) {
        if (!feed.manualUpdateMode && isSpam) {
          feed.manualUpdateMode = true;
          logger.log(`[PostStore] Manual mode enabled for ${type} due to buffer overflow`);
        }

        feed.buffer.unshift(observablePost);
        feed.newPostsCount = feed.buffer.length;
        logger.log(`[PostStore] Post ${post.id} added to ${type} buffer, size: ${feed.buffer.length}`);
      } else {
        feed.list.unshift(observablePost);
        logger.log(`[PostStore] Post ${post.id} added directly to ${type} feed`);
      }

      feed.latestPost = observablePost;
    });
  });

  /**
   * Настройка socket слушателей
   */
  setupSocketListeners = action(() => {
    if (!this.socketStore.posts) {
      logger.log("[PostStore] socket not available, will setup when ready");

      const disposer = reaction(
        () => this.socketStore.posts,
        (postsSocket) => {
          if (postsSocket) {
            this.setupSocketHandlers(postsSocket);
            disposer();
          }
        }
      );
      return;
    }

    this.setupSocketHandlers(this.socketStore.posts);
  });

  /**
   * Установка обработчиков socket событий
   */
  setupSocketHandlers(postsSocket: ReturnType<typeof io>) {
    // Убираем старые обработчики
    postsSocket.off("newPost");
    postsSocket.off("newFollowingPost");
    postsSocket.off("postLiked");
    postsSocket.off("postUnliked");

    // Добавляем только основные события
    postsSocket.on("newPost", (post: Post) => {
      logger.log("[PostStore] New post received", post.id);
      this.handleNewPost(post, "feed");
    });

    postsSocket.on("newFollowingPost", (post: Post) => {
      logger.log("[PostStore] New following post received", post.id);
      this.handleNewPost(post, "following");
    });

    postsSocket.on("postLiked", (data: { postId: string; likes: number; userId: string }) => {
      this.updatePostLikes(data.postId, data.likes, true, data.userId);
    });

    postsSocket.on("postUnliked", (data: { postId: string; likes: number; userId: string }) => {
      this.updatePostLikes(data.postId, data.likes, false, data.userId);
    });

    logger.log("[PostStore] socket handlers setup complete");
  }

  /**
   * Обновление лайков поста
   */
  private updatePostLikes(postId: string, likes: number, isLiked: boolean, userId: string) {
    runInAction(() => {
      Object.values(this.feeds).forEach(feed => {
        const post = feed.list.find(p => p.id === postId);
        if (post) {
          post.likes = likes;
          if (isLiked && !post.likedUserIds?.includes(userId)) {
            post.likedUserIds = [...(post.likedUserIds || []), userId];
          } else if (!isLiked && post.likedUserIds?.includes(userId)) {
            post.likedUserIds = post.likedUserIds.filter(id => id !== userId);
          }
        }
      });

      // Также обновляем в postsMap
      const mappedPost = this.postsMap.get(postId);
      if (mappedPost) {
        mappedPost.likes = likes;
        if (isLiked && !mappedPost.likedUserIds?.includes(userId)) {
          mappedPost.likedUserIds = [...(mappedPost.likedUserIds || []), userId];
        } else if (!isLiked && mappedPost.likedUserIds?.includes(userId)) {
          mappedPost.likedUserIds = mappedPost.likedUserIds.filter(id => id !== userId);
        }
      }
    });
  }

  /**
   * Загрузка новых постов из буфера
   */
  handleLoadNewPosts = action((type: FeedType, force = false) => {
    const feed = this.getFeed(type);

    if (feed.buffer.length === 0) {
      return;
    }

    // Если manual mode включен и не принудительная загрузка - не загружаем
    if (feed.manualUpdateMode && !force) {
      logger.log(`[PostStore] Manual mode active, skipping buffer load for ${type}`);
      return;
    }

    logger.log(`[PostStore] Moving ${feed.buffer.length} posts from buffer to list${force ? ' (forced)' : ''}`);

    runInAction(() => {
      // Кэшируем пользователей
      const uniqueUsers = new Map<string, User>();

      feed.buffer.forEach(post => {
        if (post.user?.id && post.user.userName && !uniqueUsers.has(post.user.id)) {
          uniqueUsers.set(post.user.id, post.user as User);
        } else if (post.userId && !post.user) {
          const cachedUser = this.userStore.getCachedUser(post.userId);
          if (cachedUser && !uniqueUsers.has(cachedUser.id)) {
            uniqueUsers.set(cachedUser.id, cachedUser);
            post.user = cachedUser;
          }
        }
      });

      uniqueUsers.forEach(user => {
        this.userStore.addCachedUser(user);
      });

      // Добавляем все посты из буфера в начало списка
      feed.list.unshift(...feed.buffer);

      // Очищаем буфер
      feed.buffer = [];
      feed.newPostsCount = 0;

      logger.log(`[PostStore] Added posts to ${type} feed, new list size: ${feed.list.length}`);
    });
  });


  /**
   * Установка мануального режима
   */
  setManualUpdateMode = action((type: FeedType, value: boolean) => {
    const feed = this.getFeed(type);

    if (feed.manualUpdateMode !== value) {
      feed.manualUpdateMode = value;
      logger.log(`[PostStore] Manual update mode for ${type} set to ${value}`);

      // При выключении manual mode - СРАЗУ загружаем все накопленные посты
      if (!value && feed.buffer.length > 0) {
        logger.log(`[PostStore] Loading ${feed.buffer.length} buffered posts for ${type}`);
        this.handleLoadNewPosts(type, true);
      }
    }
  });

  /**
   * Принудительная загрузка буфера (для кнопки)
   */
  loadBufferedPosts = action((type: FeedType) => {
    const feed = this.getFeed(type);
    if (feed.buffer.length > 0) {
      logger.log(`[PostStore] Manual loading of ${feed.buffer.length} buffered posts for ${type}`);
      this.handleLoadNewPosts(type, true);
    }
  });

  /**
   * Получение поста по ID (для внутреннего использования)
   */
  getItemById(postId: string): Post | undefined {
    // Сначала ищем в postsMap
    const mappedPost = this.postsMap.get(postId);
    if (mappedPost) return mappedPost;

    // Потом ищем в фидах
    for (const feed of Object.values(this.feeds)) {
      const post = feed.list.find((p) => p.id === postId);
      if (post) return post;
    }
    return undefined;
  }

  /**
   * Получение поста по slug
   */
  getPostBySlug(slug: string): Post | null {
    // Сначала ищем в postsMap
    for (const post of this.postsMap.values()) {
      if (post.slug === slug) return post;
    }

    // Потом в фидах
    for (const feed of Object.values(this.feeds)) {
      const post = feed.list.find(p => p.slug === slug);
      if (post) return post;
    }

    return null;
  }

  /**
   * Переключение лайка поста
   */
  toggleLike = action((postId: string, userId: string) => {
    const post = this.getItemById(postId);
    if (!post || !this.socketStore.posts) return;

    const isLiked = this.isItemLikedByUser(post, userId);

    runInAction(() => {
      if (isLiked) {
        post.likedUserIds = post.likedUserIds?.filter(id => id !== userId) || [];
        post.likes = Math.max(0, (post.likes || 0) - 1);
      } else {
        post.likedUserIds = [...(post.likedUserIds || []), userId];
        post.likes = (post.likes || 0) + 1;
      }
    });

    const event = isLiked ? "unlikePost" : "likePost";
    this.socketStore.posts.emit(event, { postId, userId });
  });

  /**
   * Применение сортировки ко всем коллекциям
   */
  protected override applySortToAllCollections(): void {
    Object.values(this.feeds).forEach(feed => {
      const sorted = this.applySorting([...feed.list]);
      feed.list.replace(sorted);
    });
  }

  /**
   * Загрузка комментариев к посту
   */
  loadCommentsToPost = action((postId: string) => {
    return this.commentStore.loadComments(postId);
  });


// Update processPosts to use repliesCount from server

processPosts = action((posts: Post[]) => {
  const uniqueUsers = new Map<string, User>();

  posts.forEach(post => {
    // Кэшируем пользователей - проверяем обязательные поля
    if (post.user && post.user.id && post.user.userName) {
      const roleValidated = this.userStore.validateUserRole(post.user.role);

      // Создаем полный объект User с обязательными полями
      const fullUser: User = {
        id: post.user.id,
        userName: post.user.userName,
        email: post.user.email || '',
        role: roleValidated,
        avatarUrl: post.user.avatarUrl || null,
        avatarShape: post.user.avatarShape || 'circle',
        slug: post.user.slug || post.user.userName.toLowerCase(),
        createdAt: post.user.createdAt || new Date().toISOString(),
        updatedAt: post.user.updatedAt || new Date().toISOString(),
        followers: post.user.followers || [],
        following: post.user.following || [],
        settings: post.user.settings || { debugMode: false },
      };

      uniqueUsers.set(fullUser.id, fullUser);
    }

    // Используем repliesCount с серва как commentCount для постов (надо рефакторнуть)
    if (post.commentCount === undefined || post.commentCount === null) {
      const serverCommentCount = (post as Post).repliesCount || 0;
      post.commentCount = serverCommentCount;
      
      if (serverCommentCount > 0) {
        //logger.log(`[PostStore] Set commentCount to ${serverCommentCount} (from server repliesCount) for post ${post.id}`);
      } else {
        //logger.log(`[PostStore] Initialized commentCount to 0 for post ${post.id}`);
      }
    }
  });

  // Кэшируем уникальных пользователей используя существующий метод
  uniqueUsers.forEach(user => {
    this.userStore.addCachedUser(user);
  });

  if (uniqueUsers.size > 0) {
    logger.log(`[PostStore] Cached ${uniqueUsers.size} users with roles`);
  }

  // Используем ОБЩИЕ объекты для postsMap и feeds
  posts.forEach(post => {
    // Проверяем, есть ли уже этот пост в postsMap
    const existingPost = this.postsMap.get(post.id);

    if (existingPost) {
      // Обновляем существующий пост вместо создания нового
      runInAction(() => {
        Object.assign(existingPost, post);
        logger.log(`[PostStore] Updated existing post ${post.id} in postsMap`);
      });
    } else {
      // Создаем новый observable пост только если его нет
      const observablePost = observable(post);
      this.postsMap.set(post.id, observablePost);
      //logger.log(`[PostStore] Added new post ${post.id} to postsMap`);
    }
  });
});

  /**
   * Добавление поста
   */
addPost = action((post: Post, feedType?: FeedType) => {
  runInAction(() => {
    // Кэшируем пользователя только если его еще нет в кэше
    if (post.user && post.user.id) {
      const existingUser = this.userStore.getCachedUser(post.user.id);
      if (!existingUser) {
        this.userStore.addCachedUser(post.user);
      }
    } else if (!post.user && post.userId) {
      // Если нет user объекта, но есть userId, пробуем восстановить из кэша
      const cachedUser = this.userStore.getCachedUser(post.userId);
      if (cachedUser) {
        post.user = cachedUser;
        logger.log(`[PostStore] Restored user ${cachedUser.userName} from cache for post ${post.id}`);
      } else {
        logger.warn(`[PostStore] Could not restore user data for post ${post.id}, userId: ${post.userId}`);
      }
    }

    // СНАЧАЛА обрабатываем пост через processPosts для единообразия
    this.processPosts([post]);

    // ЗАТЕМ используем ссылку из postsMap для feeds
    const mappedPost = this.postsMap.get(post.id);
    if (!mappedPost) {
      logger.error(`[PostStore] Post ${post.id} not found in postsMap after processing!`);
      return;
    }

    if (feedType) {
      const feed = this.feeds[feedType];
      if (feed) {
        const existingIndex = feed.list.findIndex(p => p.id === post.id);
        if (existingIndex >= 0) {
          feed.list[existingIndex] = mappedPost; // Используем mappedPost
          logger.log(`[PostStore] Updated existing post ${post.id} in ${feedType} feed with postsMap reference`);
        } else {
          feed.list.push(mappedPost); // Используем mappedPost
          logger.log(`[PostStore] Added new post ${post.id} to ${feedType} feed with postsMap reference`);
        }
      }
    }
  });
});

  /**
   * Перемещение скролла к началу страницы
   */
  scrollToTop = action(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    logger.log(`[PostStore] Scrolling to top`);
  });

  /**
   * Добавление поста во все ленты
   */
  addPostToAllFeeds = action((post: Post) => {
  // Используем ссылку из postsMap вместо исходного объекта
  const mappedPost = this.postsMap.get(post.id);
  if (!mappedPost) {
    logger.warn(`[PostStore] Post ${post.id} not found in postsMap when adding to feeds`);
    return;
  }

  // Добавляем пост в основную ленту, если его там нет
  const mainFeed = this.feeds.feed;
  if (!mainFeed.list.some(p => p.id === post.id)) {
    logger.log(`[PostStore] Adding post ${post.id} to main feed using postsMap reference`);
    mainFeed.list.push(mappedPost); // Используем mappedPost вместо post
  }

  // Добавляем в ленту пользователя, если это его пост
  if (post.userId && this.feeds.user.userId === post.userId) {
    const userFeed = this.feeds.user;
    if (!userFeed.list.some(p => p.id === post.id)) {
      logger.log(`[PostStore] Adding post ${post.id} to user feed using postsMap reference`);
      userFeed.list.push(mappedPost); // Используем mappedPost вместо post
    }
  }
});

  /**
   * Сохранение состояния feed
   */
  saveFeedState = action((clickScrollPosition: number) => {
    const scrollPosition = clickScrollPosition > 0 ? clickScrollPosition : 0;
    if (scrollPosition === 0) return;

    this.feedScrollPosition = scrollPosition;
    this.feedSavedPage = this.feeds.feed.page;
    this.feedSavedPosts.replace(this.feeds.feed.list.slice());
  });

  /**
   * Восстановление состояния feed
   */
  restoreFeedState = action(() => {
    if (this.isFeedStateRestored) return;

    if (this.feedSavedPosts.length > 0) {
      logger.log("[PostStore] Restoring feed from saved posts");
      this.feeds.feed.list.replace(this.feedSavedPosts);
      this.feeds.feed.page = this.feedSavedPage;
    }

    this.isFeedStateRestored = true;
  });

  /**
   * Возврат к feed
   */
  onBackToFeed = action((scrollTo: (position: number) => void) => {
    this.restoreFeedState();
    const scrollPosition = this.feedScrollPosition;
    setTimeout(() => scrollTo(scrollPosition), 250);
  });

  /**
   * Начало отслеживания скролла
   */
  startTrackingScroll = action(() => {
    const handleScroll = () => {
      // Отслеживание скролла
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    this.scrollHandler = handleScroll;
  });

  /**
   * Остановка отслеживания скролла
   */
  stopTrackingScroll = action(() => {
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
    }
  });

  /**
   * Хелпер для извлечения поста из разных форматов ответа
   */
  private extractPostFromResponse(response: FetchPostResponse | Post[] | null): Post | null {
    if (!response) return null;

    if (Array.isArray(response) && response.length > 0) {
      return response[0];
    }

    if (typeof response === 'object') {
      if ('post' in response && response.post) {
        return response.post;
      }
      if ('posts' in response && Array.isArray(response.posts) && response.posts.length > 0) {
        return response.posts[0];
      }
    }

    return null;
  }

  clearPostPromiseCache = (slug: string): void => {
    const cacheKey = `slug:${slug}`;
    if (this.fetchPostPromises.has(cacheKey)) {
      logger.log(`[PostStore] Clearing cache for post slug: ${slug}`);
      this.fetchPostPromises.delete(cacheKey);
    }
  };
  /**
   * Получение поста по slug
   */
// Update fetchPostBySlug to ensure proper reference handling

fetchPostBySlug = action(async (slug: string): Promise<Post | null> => {
  try {
    const cacheKey = `slug:${slug}`;

    // Check if a fetch is already in progress
    if (this.fetchPostPromises?.has(cacheKey)) {
      logger.log(`[PostStore] Reusing existing fetch promise for slug ${slug}`);
      return this.fetchPostPromises.get(cacheKey)!;
    }

    logger.log(`[PostStore] Fetching post by slug: ${slug}`);

    // Check if post exists in store
    const existingPost = this.getPostBySlug(slug);
    if (existingPost) {
      logger.log(`[PostStore] Found post ${slug} in store, returning cached version`);

      // Create a resolved promise for consistency
      const cachedPromise = Promise.resolve(existingPost);
      this.fetchPostPromises?.set(cacheKey, cachedPromise);

      // Clean up promise cache after a short delay
      setTimeout(() => {
        this.fetchPostPromises?.delete(cacheKey);
      }, 1000);

      return existingPost;
    }

    if (!this.socketStore.posts?.connected) {
      logger.error('[PostStore] Socket not available');
      throw new Error('Socket connection not available');
    }

    // Create a promise for handling the request
    const fetchPromise = new Promise<Post | null>((resolve, reject) => {
      this.socketStore.posts!.emit("fetchPostBySlug", { slug }, (response: FetchPostResponse) => {
        logger.log(`[PostStore] Response for slug ${slug}:`, response);

        // Handle server exception responses
        if (response && response.status === 'error') {
          logger.error(`[PostStore] Server error: ${response.message}`);
          reject(new Error(response.message || 'Server error'));
          return;
        }

        // Handle other error formats (array with "exception")
        if (Array.isArray(response) && response[0] === 'exception') {
          const errorMsg = response[1]?.message || 'Unknown server error';
          logger.error(`[PostStore] Server exception: ${errorMsg}`);
          reject(new Error(errorMsg));
          return;
        }

        const post = this.extractPostFromResponse(response);

        if (post) {
          runInAction(() => {
            // СНАЧАЛА обрабатываем пост через processPosts
            this.processPosts([post]);
            
            // ЗАТЕМ добавляем в feeds используя ссылку из postsMap
            this.addPostToAllFeeds(post);
          });
          
          // Возвращаем ссылку из postsMap для консистентности
          const mappedPost = this.postsMap.get(post.id);
          resolve(mappedPost || post);
        } else {
          logger.error(`[PostStore] No post data found in response for ${slug}`);
          resolve(null);
        }
      });

      // Add timeout to prevent hanging requests
      setTimeout(() => {
        if (this.fetchPostPromises?.has(cacheKey)) {
          logger.error(`[PostStore] Request timeout for slug ${slug}`);
          reject(new Error('Request timed out'));
        }
      }, 15000); // 15 second timeout
    });

    // Save promise in cache
    this.fetchPostPromises?.set(cacheKey, fetchPromise);

    // Clean up promise from cache on completion
    fetchPromise
      .finally(() => {
        setTimeout(() => {
          this.fetchPostPromises?.delete(cacheKey);
        }, 1000);
      });

    return fetchPromise;
  } catch (error: Error | unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[PostStore] Error fetching post by slug: ${errorMessage}`);
    this.fetchPostPromises?.delete(`slug:${slug}`);
    throw error; // Re-throw the error to be handled by the component
  }
});

  /**
   * Помечает ленту для обновления при следующей загрузке
   */
  markFeedForRefresh = action((feedType: FeedType) => {
    const feed = this.feeds[feedType];
    if (feed) {
      feed.reset = true;
      logger.log(`[PostStore] Marked ${feedType} feed for refresh`);
    }
  });
  clearCacheForSlug = (slug: string): void => {
    const cacheKey = `slug:${slug}`;
    if (this.fetchPostPromises?.has(cacheKey)) {
      this.fetchPostPromises.delete(cacheKey);
      logger.log(`[PostStore] Cleared cache for slug: ${slug}`);
    }
  };


  /**
   * Освобождение ресурсов при уничтожении
   */
  override dispose() {
    super.dispose();

    Object.values(this.intervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });

    if (this.socketStore.posts) {
      this.socketStore.posts.off("newPost");
      this.socketStore.posts.off("newFollowingPost");
      this.socketStore.posts.off("postLiked");
      this.socketStore.posts.off("postUnliked");
    }
  }
}

export default PostStore;