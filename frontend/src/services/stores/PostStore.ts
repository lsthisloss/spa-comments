import { makeObservable, observable, action, runInAction, IObservableArray, reaction, computed } from "mobx";
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
import { BatchingService } from "../main/BatchingService";

const POSTS_PER_PAGE = 25;

interface FeedState {
  list: IObservableArray<Post>; // Список постов в ленте
  allLoaded: boolean; // Флаг, что все посты загружены
  loading: boolean; // Флаг загрузки постов
  page: number; // Текущая страница
  total: number; // Общее количество постов
  buffer: Post[]; // Буфер для новых постов
  manualUpdateMode: boolean; // Режим ручного обновления ленты
  newPostsCount: number; // Количество новых постов в буфере
  latestPost: Post | null; // Последний пост в ленте
  error: Error | null; // Ошибка при загрузке постов
  reset: boolean; // Флаг сброса состояния ленты
  userId?: string; // ID пользователя для пользовательской ленты
  allowLoadMore?: boolean; // Флаг, что можно загружать больше постов
}


declare const window: Window;

/**
 Хранилище для управления постами и лентами в приложении
  Использует MobX для реактивного управления состоянием.
  Позволяет загружать, обновлять и управлять постами в разных лентах (общая, подписки, пользовательская).
*/
class PostStore extends BaseStore<Post> implements IPostStore {
  // Инъектированные сторы
  private socketStore: SocketStore;
  private userStore: UserStore;
  private commentStore: CommentStore;
  private batchingService: BatchingService<Post>;

  /*
    Карты для хранения постов и их состояния
    Три типа лент: 
    - feed: общая лента
    - following: лента подписок
    - user: пользовательская лента
  */
  feeds: Record<FeedType, FeedState> = {
    feed: {
      list: observable([]),
      allLoaded: false,
      loading: false,
      page: 1,
      total: 0,
      buffer: observable([]),
      manualUpdateMode: false,
      newPostsCount: 0,
      latestPost: null,
      error: null,
      reset: false,
      allowLoadMore: false,
    },
    following: {
      list: observable([]),
      allLoaded: false,
      loading: false,
      page: 1,
      total: 0,
      buffer: observable([]),
      manualUpdateMode: false,
      newPostsCount: 0,
      latestPost: null,
      error: null,
      reset: false,
      allowLoadMore: false,
    },
    user: {
      list: observable([]),
      allLoaded: false,
      loading: false,
      page: 1,
      total: 0,
      buffer: observable([]),
      manualUpdateMode: false,
      newPostsCount: 0,
      latestPost: null,
      error: null,
      reset: false,
      userId: undefined,
      allowLoadMore: false,
    }
  };

  // Карта для хранения постов по ID
  postsMap = observable.map<string, Post>();
  // Карта для хранения промисов получения постов по слагу  
  public fetchPostPromises = new Map<string, Promise<Post | null>>();

  // Состояние для сохранения feed
  feedScrollPosition = 0;
  feedSavedPage = 1;
  feedSavedPosts = observable.array<Post>([]);
  isFeedStateRestored = false;
  hasInitialFeedLoad = false;
  needsFeedCheck = false;

  // Таймеры
  intervals: Record<FeedType, NodeJS.Timeout | null> = {
    feed: null,
    following: null,
    user: null
  };

  constructor(socketStore: SocketStore, userStore: UserStore, commentStore: CommentStore) {
    super();

    // Сохраняем инъектированные сторы
    this.socketStore = socketStore;
    this.userStore = userStore;
    this.commentStore = commentStore;

    // Инициализируем сервис батчинга
    this.batchingService = new BatchingService<Post>(this.processBatchedPosts);

    makeObservable(this, {
      //Обсервируемые свойства
      feeds: observable,
      postsMap: observable,
      feedScrollPosition: observable,
      feedSavedPage: observable,
      feedSavedPosts: observable,
      isFeedStateRestored: observable,
      needsFeedCheck: observable,

      //Екшн методы
      setNeedsFeedCheck: action,
      getFeedLength: action,
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
      fetchPostBySlug: action,
      addPostToAllFeeds: action,
      clearResetFlag: action,
      updatePostCommentCount: action,
      processPosts: action,
      markFeedForRefresh: action,
      getUserFeedState: action,
      switchToUser: action,
      batchNewPost: action,
      setBatchingStrategy: action,
      forceFlushBatches: action,
      resetBatchStats: action,
      clearAllQueues: action,

      // Вычисляемые свойства
      currentFeedList: computed,
      currentFollowingList: computed,
      currentUserFeedList: computed,
    });


    // Инициализируем таймеры
    this.intervals = {
      feed: null,
      following: null,
      user: null
    };

    this.setupSocketListeners();
  }

  //Геттеры-декораторы для получения текущих лент
  get currentFeedList(): Post[] {
    return this.feeds.feed.list;
  }

  get currentFollowingList(): Post[] {
    return this.feeds.following.list;
  }

  get currentUserFeedList(): Post[] {
    return this.feeds.user.list;
  }

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

  public hasActiveRequest(key: string): boolean {
    return this.fetchPostPromises.has(key);
  }

  public getActiveRequest(key: string): Promise<Post | null> | undefined {
    return this.fetchPostPromises.get(key);
  }

  setNeedsFeedCheck(value: boolean) {
    this.needsFeedCheck = value;
  }

  getFeedLength() {
    return this.feeds.feed.list.length || 0;
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

  setBatchingStrategy = action((strategy: 'fixed' | 'adaptive') => {
    this.batchingService.setStrategy(strategy);
  });

  forceFlushBatches = action(() => {
    this.batchingService.forceFlushAll();
  });

  getBatchStats(feedType: FeedType) {
    return this.batchingService.getStats(feedType);
  }

  getBufferInfo(feedType: FeedType) {
    return this.batchingService.getBufferInfo(feedType);
  }

  resetBatchStats = action(() => {
    this.batchingService.resetStats();
  });

  batchNewPost = action((post: Post, type: FeedType) => {
    logger.log(`[PostStore] Adding post ${post.id} to batch for ${type} feed`);
    this.batchingService.addToBatch(post, type, post.id);
  });

  getFeed(type: FeedType, userId?: string): FeedState {
    if (type === "user" && userId) {
      const userFeed = this.feeds.user;
      if (userFeed.userId !== userId) {
        logger.log(`[PostStore] Switching user feed to ${userId}`);
        this.switchToUser(userId);
      }
      return userFeed;
    }

    return this.feeds[type];
  }

  clearFeed = action(() => {
    const feedState = this.feeds.feed;

    runInAction(() => {
      feedState.list.clear();
      feedState.allLoaded = false;
      feedState.loading = false;
      feedState.page = 1;
      feedState.total = 0;
      feedState.buffer = [];
      feedState.manualUpdateMode = false;
      feedState.newPostsCount = 0;
      feedState.latestPost = null;
      feedState.error = null;
      feedState.reset = false;
    });

    this.hasInitialFeedLoad = false;
    logger.log('[PostStore] Feed cleared for fresh load');
  });

  clearAllQueues = action(() => {
    this.batchingService.clearAllQueues();

    // Очищаем буферы лент
    for (const feed of Object.values(this.feeds)) {
      feed.buffer.splice(0);
      feed.newPostsCount = 0;
      feed.latestPost = null;
    }
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

    // Глобальная дедупликация для всех событий
    const globalProcessedPosts = new Set<string>();

    const processPostEvent = (post: Post, feedType: FeedType, eventType: string) => {
      const dedupeKey = `${post.id}:${feedType}`;

      if (globalProcessedPosts.has(dedupeKey)) {
        logger.log(`[PostStore] Skipping duplicate ${eventType} event for ${post.id} in ${feedType}`);
        return;
      }

      globalProcessedPosts.add(dedupeKey);
      this.batchingService.addToBatch(post, feedType, post.id);

      // Очищаем через 10 секунд
      setTimeout(() => globalProcessedPosts.delete(dedupeKey), 10000);
    };

    // Подключаемся к room пользователя
    if (this.userStore.user?.id) {
      postsSocket.emit('joinRoom', `user:${this.userStore.user.id}`);
      logger.log(`[PostStore] Attempting to join room: user:${this.userStore.user.id}`);

      postsSocket.on('joinedRoom', (data: { room: string; success: boolean }) => {
        logger.log(`[PostStore] Successfully joined room:`, data);
      });

      postsSocket.on('roomJoined', (data: { room: string; userId: string; success: boolean }) => {
        logger.log(`[PostStore] Room joined confirmation:`, data);
      });
    }

    //  Единый обработчик с дедупликацией
    postsSocket.on("newPost", (post: Post) => {
      logger.log("[PostStore] New post received", post.id);
      processPostEvent(post, "feed", "newPost");
    });

    postsSocket.on("newFollowingPost", (post: Post) => {
      logger.log("[PostStore] New following post received", post.id);

      const currentUserId = this.userStore.user?.id;

      // Проверяем что это релевантный пост
      if (post.userId === currentUserId ||
        (this.userStore.isFollowing && this.userStore.isFollowing(post.userId))) {

        processPostEvent(post, "following", "newFollowingPost");
      } else {
        logger.log(`[PostStore] Skipping following post from non-followed user: ${post.userId}`);
      }
    });

    // Лайки обрабатываем сразу
    postsSocket.on("postLiked", (data: { postId: string; likes: number; userId: string }) => {
      this.updatePostLikes(data.postId, data.likes, true, data.userId);
    });

    postsSocket.on("postUnliked", (data: { postId: string; likes: number; userId: string }) => {
      this.updatePostLikes(data.postId, data.likes, false, data.userId);
    });

    logger.log("[PostStore] Socket handlers setup complete with BatchingService");
  }

  /**
   * Настройка socket слушателей
   */
  setupSocketListeners = action(() => {
    if (!this.socketStore.posts) {
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

  public applySortToAllCollections(): void {
    logger.log(`[PostStore] applySortToAllCollections: no sorting for now :(`);
  }

  /*
   Конфиг сокет события для получения постов
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

  private processBatchedPosts = action((posts: Post[], feedType: FeedType) => {
    const isCrashTest = window.__CRASH_TEST_MODE__ || false;

    logger.log(`[PostStore] Processing batch of ${posts.length} posts for ${feedType}${isCrashTest ? ' (crash test)' : ''}`);

    runInAction(() => {
      const feed = this.getFeed(feedType);
      const processedPosts: Post[] = [];

      posts.forEach(post => {
        if (!post.createdAt) {
          post.createdAt = new Date().toISOString();
        }

        let observablePost = this.postsMap.get(post.id);
        if (!observablePost) {
          observablePost = observable(post);
          this.postsMap.set(post.id, observablePost);
        }

        const existingIndex = feed.list.findIndex(p => p.id === post.id);
        const bufferExists = feed.buffer.some(p => p.id === post.id);

        if (existingIndex >= 0 || bufferExists) {
          logger.log(`[PostStore] Post ${post.id} already exists, skipping`);
          return;
        }

        processedPosts.push(observablePost);
      });

      if (processedPosts.length === 0) {
        logger.log(`[PostStore] No new posts to process in batch`);
        return;
      }

      const isCurrentUserPosts = processedPosts.some(post => post.userId === this.userStore.user?.id);

      // В crash test режиме НЕ используем manual mode
      if (isCurrentUserPosts || isCrashTest) {
        // Сначала событие, ПОТОМ данные
        window.dispatchEvent(new CustomEvent('postsHeightRecalculation', {
          detail: {
            feedType,
            reason: 'newPost',
            addedCount: processedPosts.length
          }
        }));

        // Добавляем данные синхронно после события
        processedPosts.reverse().forEach(post => {
          feed.list.splice(0, 0, post);
        });
        feed.latestPost = processedPosts[0] || feed.latestPost;
        logger.log(`[PostStore] Added ${processedPosts.length} posts directly to ${feedType} feed${isCrashTest ? ' (crash test)' : ' (current user)'}`);
      }
      else {
        // Manual mode только для чужих постов вне краш-теста
        if (!feed.manualUpdateMode) {
          feed.manualUpdateMode = true;
          logger.log(`[PostStore] Manual mode enabled for ${feedType}`);
        }

        processedPosts.reverse().forEach(post => {
          feed.buffer.splice(0, 0, post);
        });
        feed.newPostsCount = feed.buffer.length;
        feed.latestPost = processedPosts[0] || feed.latestPost;
        logger.log(`[PostStore] Added ${processedPosts.length} posts to ${feedType} buffer, buffer size: ${feed.buffer.length}`);
      }
    });
  });

  /**
   * Получаем количество недавних постов
   */
  private getRecentPostActivity(feed: FeedState): number {
    const now = Date.now();
    const thirtySecondsAgo = now - 30000;


    let recentCount = 0;

    for (const post of feed.list) {
      if (post.createdAt) {
        const postTime = new Date(post.createdAt).getTime();
        if (postTime > thirtySecondsAgo) {
          recentCount++;
        } else {
          // Список отсортирован по времени, можно прервать
          break;
        }
      }
    }

    // Добавляем посты из буфера (они все свежие)
    recentCount += feed.buffer.length;

    return recentCount;
  }

  /*
    Хендлер для нового поста 
  */
  private handleNewPostInternal(post: Post, type: FeedType) {
    const feed = this.getFeed(type);
    if (!post.createdAt) {
      post.createdAt = new Date().toISOString();
    }

    // Проверяем, есть ли уже пост в postsMap
    let observablePost = this.postsMap.get(post.id);
    if (!observablePost) {
      observablePost = observable(post);
      this.postsMap.set(post.id, observablePost);
    }

    const existingIndex = feed.list.findIndex(p => p.id === post.id);
    if (existingIndex >= 0) {
      logger.log(`[PostStore] Post ${post.id} already exists in ${type} feed, skipping duplicate`);
      return;
    }

    const bufferExists = feed.buffer.some(p => p.id === post.id);
    if (bufferExists) {
      logger.log(`[PostStore] Post ${post.id} already exists in ${type} buffer, skipping duplicate`);
      return;
    }

    const isCrashTest = window.__CRASH_TEST_MODE__ || false;
    const isCurrentUserPost = post.userId === this.userStore.user?.id;

    // Всегда добавляем посты от текущего пользователя напрямую
    if (isCurrentUserPost) {
      runInAction(() => {
        const newList = [observablePost, ...feed.list];
        feed.list.replace(newList);
        logger.log(`[PostStore] Added user post ${post.id} directly to ${type} feed`);

        // Диспатчим событие для force update
        window.dispatchEvent(new CustomEvent('newPost', {
          detail: {
            post: observablePost,
            isCurrentUser: true,
            feedType: type
          }
        }));
      });
    }
    // В краш-тесте НЕ используем manual mode
    else if (isCrashTest) {
      feed.list.unshift(observablePost);
      logger.log(`[PostStore] Added post ${post.id} directly to ${type} feed (crash test mode)`);
    }
    // Проверяем нужно ли включить manual mode
    else {
      const shouldEnableManualMode = this.shouldEnableManualMode(feed, isCurrentUserPost);

      if (shouldEnableManualMode && !feed.manualUpdateMode) {
        feed.manualUpdateMode = true;
        logger.log(`[PostStore] Manual mode enabled for ${type} due to activity`);
      }

      // Если manual mode включен - в буфер, иначе напрямую
      if (feed.manualUpdateMode) {
        feed.buffer.unshift(observablePost);
        feed.newPostsCount = feed.buffer.length;
        logger.log(`[PostStore] Added post ${post.id} to ${type} buffer (manual mode), buffer size: ${feed.buffer.length}`);
      } else {
        feed.list.unshift(observablePost);
        logger.log(`[PostStore] Added post ${post.id} directly to ${type} feed`);
      }
    }
    // Обновляем последний пост
    feed.latestPost = observablePost;
  }

  /* 
  Мануал режим для ленты  
  */
  private shouldEnableManualMode(feed: FeedState, isCurrentUserPost: boolean): boolean {
    // Посты от текущего пользователя не включают manual mode
    if (isCurrentUserPost) {
      return false;
    }

    // Если уже включен - оставляем включенным
    if (feed.manualUpdateMode) {
      return true;
    }

    // Включаем manual mode при ЛЮБОЙ активности более 3 постов
    const recentActivity = this.getRecentPostActivity(feed);

    if (recentActivity > 3) {
      logger.log(`[PostStore] Activity detected (${recentActivity} posts in 30s), enabling manual mode`);
      return true;
    }

    return false;
  }

  /*
   Socket запрос с правильной обработкой ответа
  */
  private emitSocketRequest(eventName: string, eventData: SocketEventData): Promise<{ posts: Post[], total: number, isEmpty?: boolean, allLoaded?: boolean, message?: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Request timeout"));
      }, 15000);

      this.socketStore.posts!.emit(eventName, eventData, (response: SocketResponseVariant) => {
        clearTimeout(timeout);

        //logger.log(`[PostStore] Socket response for ${eventName}:`, response);

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

        //logger.log(`[PostStore] Processed ${eventName} response:`, { postsCount: posts.length, total, isEmpty, allLoaded });
        resolve({ posts, total, isEmpty, allLoaded, message });
      });
    });
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

  /*
    Обработчик нового поста, вызывается из сокета или других источников
  */
  async fetchUserPosts(userId: string, page = 1): Promise<void> {
    if (page === 1 &&
      this.feeds.user.list.length > 0 &&
      this.feeds.user.userId === userId &&
      !this.feeds.user.reset) {
      logger.log(`[PostStore] Using cached user posts for ${userId} (${this.feeds.user.list.length} posts)`);
      return Promise.resolve();
    }

    return this.fetchPosts("user", page, userId);
  }

  /*
    Получение фоллов постов
    Если есть кэшированные данные - используем их
  */
  async fetchFollowingPosts(page = 1): Promise<void> {
    if (page === 1 && this.feeds.following.list.length > 0 && !this.feeds.following.reset) {
      logger.log(`[PostStore] Using cached following data (${this.feeds.following.list.length} posts)`);
      return Promise.resolve();
    }

    return this.fetchPosts("following", page);
  }

  /*
    Получение общих постов
    Если есть кэшированные данные - используем их
  */
  async fetchFeedPosts(page = 1): Promise<void> {
    const feed = this.feeds.feed;

    if (page === 1 &&
      feed.list.length > 0 &&
      !feed.reset &&
      !feed.error &&
      !feed.loading) {
      logger.log(`[PostStore] Using cached feed data (${feed.list.length} posts)`);
      return Promise.resolve();
    }

    return this.fetchPosts("feed", page);
  }


  updatePostCommentCount = action((postId: string, count: number) => {
    logger.log(`[PostStore] updatePostCommentCount called with postId=${postId}, count=${count}`);

    // Обновляем в postsMap
    const mappedPost = this.postsMap.get(postId);
    if (mappedPost) {
      const oldCount = mappedPost.commentCount || 0;
      logger.log(`[PostStore] Updating comment count for post ${postId} in postsMap from ${oldCount} to ${count}`);
      mappedPost.commentCount = count;

      const updatedFeeds: string[] = [];
      Object.entries(this.feeds).forEach(([feedType, feed]) => {
        const feedPost = feed.list.find(p => p.id === postId);
        if (feedPost) {
          if (feedPost === mappedPost) {
            logger.log(`[PostStore] Feed ${feedType} shares reference with postsMap - auto-updated to ${count}`);
          } else {
            logger.warn(`[PostStore] Feed ${feedType} has different reference, updating manually from ${feedPost.commentCount || 0} to ${count}`);
            feedPost.commentCount = count;
          }
          updatedFeeds.push(feedType);
        }
      });

      logger.log(`[PostStore] Updated comment count in feeds: ${updatedFeeds.join(', ') || 'none'}`);
    } else {
      logger.warn(`[PostStore] Post ${postId} not found in postsMap, updating feeds directly`);

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

    // Обновляем в буферах и сохраненных постах
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

  // Загрузка постов для разных типов лент
  fetchPosts = action(async (
    type: 'feed' | 'user' | 'following',
    page: number = 1,
    userId?: string,
  ): Promise<void> => {
    // Отмечаем что была попытка загрузки
    if (type === 'feed' && page === 1) {
      this.hasInitialFeedLoad = true;
    }
    const feed = type === "user" ? this.getUserFeedState() : this.getFeed(type);

    // ENHANCED DEBUG LOGGING
    //logger.log(`[PostStore] fetchPosts called with type=${type}, page=${page}, userId=${userId || 'none'}`);
    logger.log(`[PostStore] Current feed state:`, {
      loading: feed.loading,
      allLoaded: feed.allLoaded,
      currentPage: feed.page,
      listLength: feed.list.length,
      total: feed.total
    });

    if (feed.allLoaded && feed.list.length === 0 && feed.total === 0) {
      logger.log(`[PostStore] BLOCKED: ${type} feed is empty and allLoaded is true`);
      return;
    }

    if (feed.loading && page === 1) {
      logger.log(`[PostStore] BLOCKED: already loading ${type} for page 1`);
      return;
    }

    if (page > 1 && feed.page >= page) {
      logger.log(`[PostStore] BLOCKED: page ${page} already loaded (current page: ${feed.page})`);
      return;
    }

    if (feed.allLoaded && page > 1) {
      logger.log(`[PostStore] BLOCKED: all ${type} posts already loaded`);
      return;
    }

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

      runInAction(() => {
        logger.log(`[PostStore] Processing ${result.posts.length} posts for page ${page}`);

        if (result.posts.length === 0 && result.total === 0) {
          logger.log(`[PostStore] Empty response for ${type}, setting allLoaded=true`);
          feed.allLoaded = true;
          feed.loading = false;
          feed.total = 0;
          return;
        }
        this.processPosts(result.posts);

        const postsToAdd: Post[] = [];
        result.posts.forEach(post => {
          const mappedPost = this.postsMap.get(post.id);
          if (mappedPost) {
            postsToAdd.push(mappedPost);
          } else {
            logger.warn(`[PostStore] Post ${post.id} not found in postsMap after processing`);
          }
        });

        if (page === 1) {
          const existingIds = new Set(feed.list.map(p => p.id));
          const uniquePosts = postsToAdd.filter(post => !existingIds.has(post.id));

          if (feed.list.length > 0) {
            const combinedPosts = [...feed.list, ...uniquePosts];
            combinedPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            feed.list.clear();
            feed.list.push(...combinedPosts);

            logger.log(`[PostStore] Combined existing ${feed.list.length - uniquePosts.length} posts with ${uniquePosts.length} new posts (page 1)`);
          } else {
            feed.list.push(...postsToAdd);
            logger.log(`[PostStore] Added ${postsToAdd.length} posts to empty feed (page 1)`);
          }

          feed.page = 1;
        } else {
          const existingIds = new Set(feed.list.map(p => p.id));
          const uniquePosts = postsToAdd.filter(post => !existingIds.has(post.id));

          feed.list.push(...uniquePosts);
          feed.page = page;
        }

        feed.total = result.total;
        feed.allLoaded = result.allLoaded || result.posts.length < POSTS_PER_PAGE || result.posts.length === 0;
        feed.loading = false;
        feed.error = null;
        feed.reset = false;

        logger.log(`[PostStore] Feed update complete:`, {
          listLength: feed.list.length,
          total: feed.total,
          allLoaded: feed.allLoaded,
          loading: feed.loading,
          currentPage: feed.page
        });
      });
    } catch (error) {
      logger.warn(`[PostStore] `, error);
      runInAction(() => {
        feed.loading = false;
        feed.error = error as Error;
      });
    }
  });

  // Получаем состояние ленты пользователя
  getUserFeedState(): FeedState {
    return this.feeds.user;
  }

  // Переключаемся на ленту пользователя
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

  // Загрузка дополнительных постов для ленты
  loadMore = async (type: FeedType, userId?: string) => {
    const feed = this.getFeed(type, userId);

    if (feed.loading || (feed.allLoaded && !feed.allowLoadMore)) return;

    if (feed.allowLoadMore) {
      feed.allowLoadMore = false;
    }

    // Устанавливаем состояние загрузки
    runInAction(() => {
      feed.loading = true;
    });

    const nextPage = feed.page + 1;
    //logger.log(`[PostStore] Loading more posts for ${type}, page ${nextPage}`);

    try {
      // Сохраняем текущую длину списка для последующей передачи в appendItems
      const currentLength = feed.list.length;

      let result;
      if (type === 'user' && userId) {
        result = await this.fetchUserPosts(userId, nextPage);
      } else if (type === 'following') {
        result = await this.fetchFollowingPosts(nextPage);
      } else {
        result = await this.fetchFeedPosts(nextPage);
      }

      // После завершения загрузки отправляем событие 
      // для использования appendItems вместо переинициализации
      window.dispatchEvent(new CustomEvent('appendNewItems', {
        detail: {
          feedKey: type === 'user' ? `user-${userId}` : `${type}-default`,
          startIndex: currentLength
        }
      }));

      runInAction(() => {
        feed.loading = false;
      });

      return result;
    } catch (error) {
      logger.error(`[PostStore] Error loading more posts:`, error);
      runInAction(() => {
        feed.loading = false;
        feed.error = error as Error;
      });
    }
  };

  // Сбрасываем состояние ленты
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

  // Сбрасываем флаг перезагрузки ленты
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

  // Обработчик нового поста, вызывается из сокета или других источников
  handleNewPost = action((post: Post, type: FeedType) => {
    // В обычном режиме обрабатываем сразу, в краш-тесте - через батч
    const isCrashTest = window.__CRASH_TEST_MODE__ || false;

    if (isCrashTest) {
      this.batchNewPost(post, type);
    } else {
      this.handleNewPostInternal(post, type);
    }
  });

  /*
    Обработка постов из батча
    Вызывается из BatchingService
  */
  processPosts = action((posts: Post[]) => {
    // Группируем все операции в один runInAction
    runInAction(() => {
      const uniqueUsers = new Map<string, User>();

      posts.forEach(post => {
        // Кэшируем пользователей
        if (post.user && post.user.id && post.user.userName) {
          const roleValidated = this.userStore.validateUserRole(post.user.role);

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

        // Обрабатываем commentCount
        if (post.commentCount === undefined || post.commentCount === null) {
          const serverCommentCount = (post as Post).repliesCount || 0;
          post.commentCount = serverCommentCount;
        }
      });

      // Кэшируем пользователей
      uniqueUsers.forEach(user => {
        this.userStore.addCachedUser(user);
      });

      // Обрабатываем посты
      posts.forEach(post => {
        const existingPost = this.postsMap.get(post.id);

        if (existingPost) {
          Object.assign(existingPost, post);
        } else {
          const observablePost = observable(post);
          this.postsMap.set(post.id, observablePost);
        }
      });
    });
  });


  /**
   * Загрузка новых постов из буфера
   */
  handleLoadNewPosts = action((type: FeedType, force = false) => {
    const feed = this.getFeed(type);

    if (feed.buffer.length === 0) {
      return;
    }

    logger.log(`[PostStore] Moving ${feed.buffer.length} posts from buffer to list${force ? ' (forced)' : ''}`);

    runInAction(() => {
      // Добавляем по одному через splice
      const bufferPosts = [...feed.buffer];
      bufferPosts.reverse().forEach(post => {
        feed.list.splice(0, 0, post);
      });

      // Очищаем буфер
      feed.buffer.length = 0; // Очищаем массив на месте
      feed.newPostsCount = 0;

      // Отправляем событие для синхронизации виртуального списка
      window.dispatchEvent(new CustomEvent('bufferedPostsLoaded'));

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
   * Получение поста по ID
   */
  fetchPostById = action(async (id: string): Promise<Post | null> => {
    try {
      const cacheKey = `id:${id}`;

      // Проверяем кэш promises
      if (this.fetchPostPromises?.has(cacheKey)) {
        logger.log(`[PostStore] Reusing existing fetch promise for id ${id}`);
        return this.fetchPostPromises.get(cacheKey)!;
      }

      //logger.log(`[PostStore] Fetching post by id: ${id}`);

      // Проверяем в postsMap
      const existingPost = this.postsMap.get(id);
      if (existingPost) {
        logger.log(`[PostStore] Found post ${id} in postsMap`);
        const cachedPromise = Promise.resolve(existingPost);
        this.fetchPostPromises?.set(cacheKey, cachedPromise);
        setTimeout(() => this.fetchPostPromises?.delete(cacheKey), 1000);
        return existingPost;
      }

      if (!this.socketStore.posts?.connected) {
        throw new Error('Socket connection not available');
      }

      const fetchPromise = new Promise<Post | null>((resolve, reject) => {
        this.socketStore.posts!.emit("fetchPostById", { id }, (response: FetchPostResponse) => {
          logger.log(`[PostStore] Response for id ${id}:`, response);

          if (response && response.status === 'error') {
            reject(new Error(response.message || 'Server error'));
            return;
          }

          const post = this.extractPostFromResponse(response);
          if (post) {
            runInAction(() => {
              this.processPosts([post]);
              this.addPostToAllFeeds(post);
            });
            resolve(post);
          } else {
            logger.error(`[PostStore] No post data found in response for ${id}`);
            resolve(null);
          }
        });

        setTimeout(() => {
          reject(new Error('Request timed out'));
        }, 15000);
      });

      this.fetchPostPromises?.set(cacheKey, fetchPromise);

      fetchPromise.finally(() => {
        setTimeout(() => {
          this.fetchPostPromises?.delete(cacheKey);
        }, 1000);
      });

      return fetchPromise;
    } catch (error) {
      logger.error(`[PostStore] Error fetching post by id:`, error);
      this.fetchPostPromises?.delete(`id:${id}`);
      throw error;
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
  public getPostBySlug(slug: string): Post | null {
    // Ищем в postsMap
    for (const [, post] of this.postsMap.entries()) {
      if (post.slug === slug) {
        return post;
      }
    }

    // Ищем в feed
    for (const post of this.feeds.feed.list) {
      if (post.slug === slug) {
        return post;
      }
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
   * Загрузка комментариев к посту
   */
  loadCommentsToPost = action((postId: string) => {
    return this.commentStore.loadComments(postId);
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
        throw new Error('Socket connection not available');
      }

      let timeoutId: NodeJS.Timeout;

      const fetchPromise = new Promise<Post | null>((resolve, reject) => {
        this.socketStore.posts!.emit("fetchPostBySlug", { slug }, (response: FetchPostResponse) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          logger.log(`[PostStore] Response for slug ${slug}:`, response);

          if (response && response.status === 'error') {
            logger.error(`[PostStore] Server error: ${response.message}`);
            reject(new Error(response.message || 'Server error'));
            return;
          }

          if (Array.isArray(response) && response[0] === 'exception') {
            const errorMsg = response[1]?.message || 'Unknown server error';
            logger.error(`[PostStore] Server exception: ${errorMsg}`);
            reject(new Error(errorMsg));
            return;
          }

          const post = this.extractPostFromResponse(response);

          if (post) {
            runInAction(() => {
              this.processPosts([post]); // Обрабатываем пост
              this.addPostToAllFeeds(post); // Добавляем в ленты

              const mappedPost = this.postsMap.get(post.id);
              if (mappedPost) {
                logger.log(`[PostStore] Post ${post.id} successfully added to postsMap`);
                resolve(mappedPost); // ВОЗВРАЩАЕМ mappedPost
              } else {
                logger.error(`[PostStore] Failed to add post ${post.id} to postsMap`);
                resolve(post); // Fallback к исходному посту
              }
            });
          } else {
            logger.error(`[PostStore] No post data found in response for ${slug}`);
            resolve(null);
          }
        });

        timeoutId = setTimeout(() => {
          logger.error(`[PostStore] Request timeout for slug ${slug}`);
          reject(new Error('Request timed out'));
        }, 15000); // 15 second timeout
      });

      // Save promise in cache
      this.fetchPostPromises?.set(cacheKey, fetchPromise);

      // Clean up promise from cache on completion
      fetchPromise
        .finally(() => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          setTimeout(() => {
            this.fetchPostPromises?.delete(cacheKey);
          }, 1000);
        });

      return fetchPromise;
    } catch (error: Error | unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[PostStore] Error fetching post by slug: ${errorMessage}`);
      this.fetchPostPromises?.delete(`slug:${slug}`);
      throw error; // ретранслируем ошибку дальше
    }
  });

  // Отметка ленты для перезагрузки
  markFeedForRefresh = action((feedType: FeedType) => {
    const feed = this.feeds[feedType];
    if (feed) {
      // НЕ сбрасываем данные сразу, только помечаем флаг
      feed.reset = true;
      logger.log(`[PostStore] Marked ${feedType} feed for refresh (data preserved until next load)`);
    }
  });

  // Очистка кэша для slug
  clearCacheForSlug = (slug: string): void => {
    const cacheKey = `slug:${slug}`;
    if (this.fetchPostPromises?.has(cacheKey)) {
      this.fetchPostPromises.delete(cacheKey);
      logger.log(`[PostStore] Cleared cache for slug: ${slug}`);
    }
  };

  // Сброс флага allLoaded для ленты
  resetAllLoadedFlag = action((feedType: FeedType, userId?: string): void => {
    const feed = this.getFeed(feedType, userId);

    if (feed.allLoaded) {
      logger.log(`[PostStore] Resetting allLoaded flag for ${feedType} feed${userId ? ` (user: ${userId})` : ''}`);
      feed.allLoaded = false;
      feed.allowLoadMore = true;
    }
  });

  // Обработчик навигации назад
  handleBackNavigation = action((feedType: FeedType, userId?: string): void => {
    const feed = this.getFeed(feedType, userId);

    logger.log(`[PostStore] Handling back navigation for ${feedType} feed${userId ? ` (user: ${userId})` : ''}`);

    // Всегда разрешаем загрузку еще
    feed.allowLoadMore = true;

    if (feed.list.length > 0) {
      logger.log(`[PostStore] Enabling load more for existing data (${feed.list.length} items)`);

      // Если есть флаг refresh, но данные актуальные - сбрасываем флаг
      if (feed.reset) {
        logger.log(`[PostStore] Clearing refresh flag for ${feedType} - using existing data`);
        feed.reset = false;
      }
    } else {
      logger.log(`[PostStore] No cached data, will need to load fresh`);
      // Оставляем reset flag как есть для загрузки свежих данных
    }

    // Корректируем page только если нужно
    if (feed.list.length <= 50 && feed.page > 2) {
      logger.log(`[PostStore] Adjusting page from ${feed.page} to 2 for better load more`);
      feed.page = 2;
    }
  });

  /**
   * Освобождение ресурсов при уничтожении
   */
  override dispose() {
    super.dispose();

    // Освобождаем ресурсы батчинг сервиса
    this.batchingService.dispose();

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