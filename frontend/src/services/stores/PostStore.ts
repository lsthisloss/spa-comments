import { makeObservable, observable, action, runInAction, IObservableArray, reaction } from "mobx";
import { BaseStore } from "./BaseStore";
import { Post } from "../../types/interfaces";
import { socketStore } from "./SocketStore";
import { commentStore } from "./CommentStore";
import { logger } from "../../utils/Logger";
import io from "socket.io-client";

interface BaseSocketResponse {
  error?: string;
}

interface PostsSocketResponse extends BaseSocketResponse {
  posts?: Post[];
  total?: number;
}

interface FetchPostResponse extends BaseSocketResponse {
  post?: Post;
  posts?: Post[];
}

interface NestedPostsSocketResponse extends BaseSocketResponse {
  posts?: {
    posts: Post[];
    total: number;
  };
  total?: number;
}

type SocketResponseVariant = PostsSocketResponse | NestedPostsSocketResponse | Post[] | BaseSocketResponse;

interface SocketEventData {
  userId?: string;
  page?: number;
  limit?: number;
  postId?: string;
}

const POSTS_PER_PAGE = 25;
const TIME_WINDOW_MS = 2000;

/**
 * Типы лент постов
 */
export type FeedType = "feed" | "following" | "user";

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
class PostStore extends BaseStore<Post> {
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

  constructor() {
    super();
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
      getUserFeed: action,
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
      fetchPostById: action,
      addPostToAllFeeds: action,
      clearResetFlag: action,
      updatePostCommentCount: action,
    });

    logger.log("[PostStore] Initialized");
    this.setupSocketListeners();
    this.startBufferInterval("feed");
    this.startBufferInterval("following");
    this.startBufferInterval("user");
  }

  /**
   * Универсальный метод получения ленты
   */
  getFeed(type: FeedType): FeedState {
    return this.feeds[type];
  }

  /**
   * Получение ленты для конкретного пользователя с автосбросом при смене
   */
  getUserFeed(userId: string): FeedState {
    const userFeed = this.feeds.user;
    
    // Если это другой пользователь - сбрасываем состояние
    if (userFeed.userId !== userId) {
      logger.log(`[PostStore] Switching user feed from ${userFeed.userId} to ${userId}`);
      runInAction(() => {
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
    }
    
    return userFeed;
  }

  updatePostCommentCount = action((postId: string, count: number) => {
    // Находим пост во всех фидах и обновляем
    Object.values(this.feeds).forEach(feed => {
      const post = feed.list.find(p => p.id === postId);
      if (post) {
        post.commentCount = count;
      }
    });
  });
  /**
   * Загрузка постов
   */

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
   * Socket запрос с правильной обработкой ответа
   */
  private emitSocketRequest(eventName: string, eventData: SocketEventData): Promise<{ posts: Post[], total: number }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Request timeout"));
      }, 15000);

      socketStore.posts!.emit(eventName, eventData, (response: SocketResponseVariant) => {
        clearTimeout(timeout);
        
        console.log(`[PostStore] Socket response for ${eventName}:`, response);
        
        // Проверяем на ошибку
        if (response && typeof response === 'object' && 'error' in response && response.error) {
          reject(new Error(response.error));
          return;
        }

        let posts: Post[] = [];
        let total: number = 0;

        // Обработка разных форматов ответа
        if (Array.isArray(response)) {
          // Простой массив постов
          posts = response;
          total = response.length;
        } else if (response && typeof response === 'object') {
          // Объект с полями posts и total
          const objectResponse = response as PostsSocketResponse | NestedPostsSocketResponse;
          
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

        console.log(`[PostStore] Processed ${eventName} response:`, { postsCount: posts.length, total });
        resolve({ posts, total });
      });
    });
  }

  /**
   * Сброс состояния ленты
   */
  resetFeedState(type: FeedType = "feed", userId?: string) {
    let feed: FeedState;
    
    if (type === "user" && userId) {
      feed = this.getUserFeed(userId);
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
  }

  /**
   * Настройка socket слушателей
   */
  setupSocketListeners() {
    if (!socketStore.posts) {
      logger.log("[PostStore] socket not available, will setup when ready");
      
      const disposer = reaction(
        () => socketStore.posts,
        (postsSocket) => {
          if (postsSocket) {
            this.setupSocketHandlers(postsSocket);
            disposer();
          }
        }
      );
      return;
    }
    
    this.setupSocketHandlers(socketStore.posts);
  }

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
    });
  }

  clearResetFlag(feedType: FeedType, userId?: string) {
    let feed: FeedState;
    
    if (feedType === "user" && userId) {
      feed = this.getUserFeed(userId);
    } else {
      feed = this.getFeed(feedType);
    }
    
    runInAction(() => {
      if (feed) {
        feed.reset = false;
        logger.log(`[PostStore] Cleared reset flag for ${feedType} feed${userId ? ` (user: ${userId})` : ''}`);
      }
    });
  }

  /**
   * Запуск интервала буфера
   */
  private startBufferInterval(type: FeedType) {
    if (this.intervals[type]) clearInterval(this.intervals[type]!);

    this.intervals[type] = setInterval(() => {
      const feed = this.getFeed(type);
      
      runInAction(() => {
        if (!feed.manualUpdateMode && feed.buffer.length > 0) {
          this.handleLoadNewPosts(type);
        }
      });
    }, TIME_WINDOW_MS);
  }

  /**
   * Получение поста по ID
   */
  getItemById(postId: string): Post | undefined {
    return this.getPostById(postId);
  }

  /**
   * Получение поста по ID
   */
  getPostById(postId: string): Post | undefined {
    for (const feed of Object.values(this.feeds)) {
      const post = feed.list.find((p) => p.id === postId);
      if (post) return post;
    }
    return undefined;
  }

  /**
   * Переключение лайка поста
   */
  toggleLike(postId: string, userId: string) {
    const post = this.getPostById(postId);
    if (!post || !socketStore.posts) return;

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
    socketStore.posts.emit(event, { postId, userId });
  }

  /**
   * Применение сортировки ко всем коллекциям
   */
  protected applySortToAllCollections(): void {
    Object.values(this.feeds).forEach(feed => {
      const sorted = this.applySorting([...feed.list]);
      feed.list.replace(sorted);
    });
  }

  /**
   * Загрузка комментариев к посту
   */
  loadCommentsToPost(postId: string) {
    return commentStore.loadComments(postId);
  }

  /**
   * Добавление поста
   */
  addPost(post: Post) {
    const existingIds = new Set();
    Object.values(this.feeds).forEach(feed => {
      feed.list.forEach(p => existingIds.add(p.id));
    });

    if (!existingIds.has(post.id)) {
      const observablePost = observable(post);
      this.feeds.feed.list.unshift(observablePost);
    }
  }

  /**
   * Добавление поста во все ленты
   */
  addPostToAllFeeds(post: Post) {
    // Добавляем пост в основную ленту, если его там нет
    const mainFeed = this.feeds.feed;
    if (!mainFeed.list.some(p => p.id === post.id)) {
      logger.log(`[PostStore] Adding post ${post.id} to main feed`);
      mainFeed.list.push(post);
    }
    
    // Добавляем в ленту пользователя, если это его пост
    if (post.userId && this.feeds.user.userId === post.userId) {
      const userFeed = this.feeds.user;
      if (!userFeed.list.some(p => p.id === post.id)) {
        logger.log(`[PostStore] Adding post ${post.id} to user feed`);
        userFeed.list.push(post);
      }
    }
  }

  /**
   * Сохранение состояния feed
   */
  saveFeedState(clickScrollPosition: number) {
    const scrollPosition = clickScrollPosition > 0 ? clickScrollPosition : 0;
    if (scrollPosition === 0) return;

    this.feedScrollPosition = scrollPosition;
    this.feedSavedPage = this.feeds.feed.page;
    this.feedSavedPosts.replace(this.feeds.feed.list.slice());
  }

  /**
   * Восстановление состояния feed
   */
  restoreFeedState() {
    if (this.isFeedStateRestored) return;

    if (this.feedSavedPosts.length > 0) {
      logger.log("[PostStore] Restoring feed from saved posts");
      this.feeds.feed.list.replace(this.feedSavedPosts);
      this.feeds.feed.page = this.feedSavedPage;
    }

    this.isFeedStateRestored = true;
  }

  /**
   * Возврат к feed
   */
  onBackToFeed(scrollTo: (position: number) => void) {
    this.restoreFeedState();
    const scrollPosition = this.feedScrollPosition;
    setTimeout(() => scrollTo(scrollPosition), 250);
  }

  /**
   * Начало отслеживания скролла
   */
  startTrackingScroll() {
    const handleScroll = () => {
      // Отслеживание скролла
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    this.scrollHandler = handleScroll;
  }

  /**
   * Остановка отслеживания скролла
   */
  stopTrackingScroll() {
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
    }
  }
  
async fetchPostById(postId: string): Promise<Post | null> {
  try {
    // Check if we already have a request in progress for this post
    if (this.fetchPostPromises.has(postId)) {
      logger.log(`[PostStore] Reusing existing fetch promise for post ${postId}`);
      return this.fetchPostPromises.get(postId)!;
    }
    
    logger.log(`[PostStore] Fetching post with ID ${postId}`);
    
    // Check if post exists in store first
    const existingPost = this.getPostById(postId);
    if (existingPost) {
      logger.log(`[PostStore] Found post ${postId} in store, returning cached version`);
      return existingPost;
    }
    
    if (!socketStore.posts) {
      logger.error('[PostStore] socket not available');
      return null;
    }
    
    // Create a new promise that will be shared by all concurrent requests
    const fetchPromise = new Promise<Post | null>((resolve) => {
      socketStore.posts!.emit("fetchPost", { postId }, (response: FetchPostResponse | Post[] | null) => {
        logger.log(`Response for post ${postId}:`, response);
        
        let post: Post | null = null;
        
        if (response && typeof response === 'object') {
          if ('post' in response && response.post) {
            post = response.post;
          } else if ('posts' in response && Array.isArray(response.posts) && response.posts.length > 0) {
            post = response.posts[0];
          } else if (Array.isArray(response) && response.length > 0) {
            post = response[0];
          }
        }
        
        if (post) {
          runInAction(() => {
            // Add to all feeds
            this.addPostToAllFeeds(post);
          });
        }
        
        // Clean up the promise from the map
        this.fetchPostPromises.delete(postId);
        resolve(post);
      });
    });
    
    // Store the promise for reuse by concurrent requests
    this.fetchPostPromises.set(postId, fetchPromise);
    
    return fetchPromise;
  } catch (error) {
    logger.error("[PostStore] Error fetching post:", error);
    this.fetchPostPromises.delete(postId);
    return null;
  }
}

async fetchPosts(feedType: FeedType, page = 1, targetUserId?: string): Promise<void> {
  let feed: FeedState;

  if (targetUserId) {
    feed = this.getUserFeed(targetUserId);
    feedType = "user";
  } else {
    feed = this.getFeed(feedType);
  }

  if (feed.loading) {
    logger.log(`[PostStore] ${feedType} already loading, skipping fetchPosts`);
    return;
  }

  runInAction(() => {
    feed.loading = true;
    feed.error = null;
  });

  if (!socketStore.posts?.connected) {
    runInAction(() => {
      feed.error = new Error("Posts socket not available");
      feed.loading = false;
    });
    return;
  }

  logger.log(`[PostStore] Fetching posts: type=${feedType}, page=${page}, user=${targetUserId || 'none'}`);

  try {
    const { eventName, eventData } = this.getSocketEventConfig(feedType, targetUserId, page);
    const result = await this.emitSocketRequest(eventName, eventData);

    logger.log(`[PostStore] Received ${result.posts.length} posts, total: ${result.total}`);

    runInAction(() => {
      const posts = result.posts || [];
      const total = result.total || 0;

      if (page === 1) {
        feed.list.replace(posts.map(post => observable(post)));
        logger.log(`[PostStore] Replaced ${feedType} feed with ${posts.length} posts`);
      } else {
        const existingIds = new Set(feed.list.map(p => p.id));
        const newPosts = posts.filter(p => !existingIds.has(p.id));

        if (newPosts.length > 0) {
          feed.list.push(...newPosts.map(post => observable(post)));
          logger.log(`[PostStore] Added ${newPosts.length} new posts to ${feedType} feed`);
        } else {
          logger.log(`[PostStore] No new posts to add for page ${page}`);
        }
      }

      feed.page = page;
      feed.total = total;

      const hasReachedEnd = posts.length < POSTS_PER_PAGE;
      const hasLoadedAll = feed.list.length >= total;

      feed.allLoaded = hasReachedEnd || hasLoadedAll;

      logger.log(`[PostStore] ${feedType} feed: ${feed.list.length}/${total} posts, page: ${page}, allLoaded: ${feed.allLoaded} (reachedEnd: ${hasReachedEnd}, loadedAll: ${hasLoadedAll})`);

      feed.loading = false;
    });
  } catch (error) {
    runInAction(() => {
      feed.loading = false;
      feed.error = error as Error;
    });
    logger.error(`[PostStore] Failed to fetch ${feedType} posts:`, error);
    throw error;
  }
}
/**
 * Загрузка следующей страницы 
 */
loadMore(feedType: FeedType, targetUserId?: string) {
  const feed = targetUserId ? this.getUserFeed(targetUserId) : this.getFeed(feedType);

  if (feed.loading || feed.allLoaded) {
    logger.log(`[PostStore] Skipping loadMore: loading=${feed.loading}, allLoaded=${feed.allLoaded}`);
    return;
  }

  const nextPage = feed.page + 1;
  logger.log(`[PostStore] Loading more ${feedType} posts, page ${nextPage}`);
  this.fetchPosts(feedType, nextPage, targetUserId);
}
/**
 * Обработка нового поста
 */
handleNewPost(post: Post, type: FeedType) {
  const feed = this.getFeed(type);
  
  // Проверяем дублирование
  const existsInList = feed.list.some(p => p.id === post.id);
  const existsInBuffer = feed.buffer.some(p => p.id === post.id);
  
  if (existsInList) {
    logger.log(`[PostStore] Post ${post.id} already exists in ${type} feed list, skipping`);
    return;
  }
  
  if (existsInBuffer) {
    logger.log(`[PostStore] Post ${post.id} already exists in buffer, skipping`);
    return;
  }
  
  const observablePost = observable(post);
  
  runInAction(() => {
    feed.latestPost = observablePost;
    
    if (feed.manualUpdateMode) {
      // В мануальном режиме добавляем в буфер
      feed.buffer.unshift(observablePost);
      feed.newPostsCount = feed.buffer.length;
      logger.log(`[PostStore] New post ${post.id} added to buffer (manual mode is on), buffer size: ${feed.buffer.length}`);
    } else {
      // В обычном режиме добавляем сразу в список
      feed.list.unshift(observablePost);
      logger.log(`[PostStore] New post ${post.id} added directly to ${type} feed (manual mode is off)`);
    }
  });
}
/**
 * Загрузка новых постов из буфера
 */
handleLoadNewPosts = (type: FeedType) => {
  const feed = this.getFeed(type);
  
  runInAction(() => {
    if (feed.buffer.length === 0) {
      logger.log(`[PostStore] No new posts in buffer for ${type}`);
      return;
    }
    
    logger.log(`[PostStore] Moving ${feed.buffer.length} posts from buffer to list`);
    
    // Просто добавляем все посты из буфера в начало списка
    // Дедупликация уже сделана при добавлении в буфер
    feed.list.unshift(...feed.buffer);
    
    // Очищаем буфер
    feed.buffer = [];
    feed.newPostsCount = 0;
    
    logger.log(`[PostStore] Added posts to ${type} feed, new list size: ${feed.list.length}`);
  });
}

/**
 * Установка мануального режима - простая версия
 */
setManualUpdateMode(type: FeedType, value: boolean) {
  const feed = this.getFeed(type);
  
  if (feed.manualUpdateMode !== value) {
    logger.log(`[PostStore] Setting ${type} manual mode to ${value}`);
    runInAction(() => {
      feed.manualUpdateMode = value;
    });
  }
}

  override dispose() {
    super.dispose();
    
    Object.values(this.intervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });

    if (socketStore.posts) {
      socketStore.posts.off("newPost");
      socketStore.posts.off("newFollowingPost");
      socketStore.posts.off("postLiked");
      socketStore.posts.off("postUnliked");
    }
  }
}

export const postStore = new PostStore();