import { action, observable, runInAction, reaction, makeObservable, computed, AnnotationMapEntry } from "mobx";
import { Comment as CommentType, FetchCommentsResponse, FetchCommentBySlugResponse, User } from "../../types/interfaces";
import { logger } from '../../utils/Logger';
import { BaseStore } from "./BaseStore";
import io from "socket.io-client";
import type SocketStore from "./SocketStore";
import type UserStore from "./UserStore";
import { ICommentStore } from "../../types/stores";
import PostStore from "./PostStore";

/**
 * Хранилище для управления комментариями
 */
class CommentStore extends BaseStore<CommentType> implements ICommentStore {
  // Карты для хранения данных
  commentsMap = new Map<string, CommentType[]>();
  repliesMap = new Map<string, CommentType[]>();
  repliesShownMap = new Map<string, boolean>();
  loadingRepliesMap = new Map<string, boolean>();
  // Кэширование запросов и времени
  private lastUpdateTimeMap = new Map<string, number>();
  private loadCommentsPromises = new Map<string, Promise<void>>();
  private fetchCommentPromises = new Map<string, Promise<CommentType | null>>();
  private activeRepliesRequests = new Map<string, boolean>();

  // Состояние для страницы комментариев
  commentScrollPosition: number = 0;
  commentStateRestored: boolean = false;
  savedCommentReplies: Array<CommentType> = [];
  
  // Инъектированные сторы
  private socketStore: SocketStore;
  private userStore: UserStore;
  private postStore: PostStore | null = null;

constructor(socketStore: SocketStore, userStore: UserStore) {
  super(); // Вызываем конструктор базового класса
  
  // Сохраняем ссылки на инъектированные сторы
  this.socketStore = socketStore;
  this.userStore = userStore;
  this.postStore = null;
  const annotations: Record<string, AnnotationMapEntry> = {
    commentsMap: observable,
    repliesMap: observable,
    repliesShownMap: observable,
    loadingRepliesMap: observable,
    commentScrollPosition: observable,
    commentStateRestored: observable,
    savedCommentReplies: observable,
    
    // Computed свойства
    sortedComments: computed,
    
    // Actions
    setupSocketListeners: action,
    handleNewComment: action,
    loadComments: action,
    loadMoreComments: action,
    toggleRepliesShown: action,
    createComment: action,
    reSortComments: action,
    addComment: action,
    setReplies: action,
    setRepliesShown: action,
    setLoadingReplies: action,
    setComments: action,
    toggleLike: action,
    fetchCommentBySlug: action,
    saveCommentState: action,
    restoreCommentState: action,
    
    // Реализации абстрактных методов
    getItemById: action,
    applySortToAllCollections: action
};

// Добавляем после создания объекта
  annotations['applySortToAllCollections'] = action;

  makeObservable(this, annotations);
  
  // Инициализируем после makeObservable
  this.setupSocketListeners();
}

  /**
   * Настраивает слушателей socket-событий
   */
  setupSocketListeners = () => {
    if (!this.socketStore.comments) {
      logger.log("[CommentStore] Socket not available, will set up listeners when connection is established");
      
      // Наблюдаем за изменением socketStore.comments и устанавливаем обработчики, когда он станет доступен
      const disposer = reaction(
        () => this.socketStore.comments,
        (commentsSocket) => {
          if (commentsSocket) {
            this.setupSocketHandlers(commentsSocket);
            disposer(); // Прекращаем наблюдение, когда установили обработчики
          }
        }
      );
      
      return;
    }
    
    this.setupSocketHandlers(this.socketStore.comments);
  }

  setupSocketHandlers = (commentsSocket: ReturnType<typeof io>) => {
    commentsSocket.off("newComment");
    commentsSocket.off("commentLiked");
    commentsSocket.off("commentUnliked");
    
    commentsSocket.on("newComment", this.handleNewComment);
    
    // Используем единый обработчик для обоих типов событий
    commentsSocket.on("commentLiked", (data: { commentId: string; userId: string; newLikeCount: number; likedUserIds: string[] }) => 
      this.handleLikeEvent({ ...data, type: 'like' }));
    
    commentsSocket.on("commentUnliked", (data: { commentId: string; userId: string; newLikeCount: number; likedUserIds: string[] }) => 
      this.handleLikeEvent({ ...data, type: 'unlike' }));
    
    logger.log("[CommentStore] Socket handlers setup complete");
  }
  
  /**
   * Возвращает отсортированные комментарии для поста
   */
  get sortedComments() {
    return (postId: string): CommentType[] => {
      const comments = this.commentsMap.get(postId) || [];
      return this.applySorting([...comments]);
    };
  }
  
  /**
   * Реализация абстрактного метода из BaseStore
   * Пересортировывает все коллекции комментариев
   */
  protected override applySortToAllCollections(): void {
    runInAction(() => {
      this.commentsMap.forEach((comments, postId) => {
        if (comments.length > 0) {
          const sortedComments = this.applySorting([...comments]);
          this.commentsMap.set(postId, sortedComments);
        }
      });
      
      this.repliesMap.forEach((replies, parentId) => {
        if (replies.length > 0) {
          const sortedReplies = this.applySorting([...replies]);
          this.repliesMap.set(parentId, sortedReplies);
        }
      });
    });
  }

  /**
   * Устанавливает хранилище постов
   */
  setPostStore(postStore: PostStore | null) {
    this.postStore = postStore;
  }
  
  /**
   * Добавляет комментарий в хранилище
   */
  addComment = action((comment: CommentType, parentId?: string): void => {
  // Проверяем наличие обязательных полей перед кэшированием
  if (comment.user && comment.user.id && comment.user.userName) {
    // Создаем полный объект пользователя с ролью для кэширования
    const userForCache: User = {
      id: comment.user.id,
      userName: comment.user.userName,
      email: comment.user.email || '',
      avatarUrl: comment.user.avatarUrl || null,
      avatarShape: (comment.user.avatarShape as 'circle' | 'square') || 'circle',
      role: comment.user.role || 'user',
      slug: comment.user.slug || comment.user.userName.toLowerCase(),
    };
    
    this.userStore.addCachedUser(userForCache);
  }
  
  // Если нет user объекта, но есть userId, пробуем восстановить из кэша
  if (!comment.user && comment.userId) {
    const cachedUser = this.userStore.getCachedUser(comment.userId);
    if (cachedUser) {
      comment.user = cachedUser;
    }
  }

  if (parentId) {
    // Для ответов используем repliesMap
    if (!this.repliesMap.has(parentId)) {
      this.repliesMap.set(parentId, []);
    }
    
    const replies = this.repliesMap.get(parentId)!;
    const existingIndex = replies.findIndex(c => c.id === comment.id);
    
    if (existingIndex >= 0) {
      replies[existingIndex] = comment;
    } else {
      replies.push(comment);
    }
  } else if (comment.postId) {
    // Для комментариев к посту используем commentsMap
    if (!this.commentsMap.has(comment.postId)) {
      this.commentsMap.set(comment.postId, []);
    }
    
    const comments = this.commentsMap.get(comment.postId)!;
    const existingIndex = comments.findIndex(c => c.id === comment.id);
    
    if (existingIndex >= 0) {
      comments[existingIndex] = comment;
    } else {
      comments.push(comment);
    }
  }
});

  /**
   * Обрабатывает массив комментариев и кэширует пользователей
   */
  private cacheUsersFromComments(comments: CommentType[]) {
    const uniqueUsers = new Map<string, User>();
    
    comments.forEach(comment => {
      // Кэшируем пользователя из comment.user (новый источник с ролью)
      if (comment.user && comment.user.id && comment.user.userName) {
        const existingUser = uniqueUsers.get(comment.user.id);
        if (!existingUser) {
          uniqueUsers.set(comment.user.id, {
            id: comment.user.id,
            userName: comment.user.userName,
            email: comment.user.email || '',
            avatarUrl: comment.user.avatarUrl || null,
            avatarShape: (comment.user.avatarShape as 'circle' | 'square') || 'circle',
            role: comment.user.role || 'user', // Берем роль из comment.user
            slug: comment.user.slug || comment.user.userName.toLowerCase(),
          } as User);
        }
      }
      // Fallback к старым полям если user не заполнен
      else if (comment.userId && comment.userName) {
        const existingUser = uniqueUsers.get(comment.userId);
        if (!existingUser) {
          uniqueUsers.set(comment.userId, {
            id: comment.userId,
            userName: comment.userName,
            email: '',
            avatarUrl: comment.avatarUrl || null,
            avatarShape: (comment.avatarShape as 'circle' | 'square') || 'circle',
            role: 'user', // Для старых данных ставим user по умолчанию
            slug: comment.userName.toLowerCase(),
          } as User);
        }
      }
    });
    
    // Кэшируем пользователей в UserStore
    uniqueUsers.forEach(user => {
      this.userStore.addCachedUser(user);
    });
    
    if (uniqueUsers.size > 0) {
      logger.log(`[CommentStore] Cached ${uniqueUsers.size} users with roles from comments`);
    }
  }

  /**
   * Обрабатывает массив комментариев и кэширует пользователей
   */
  private processComments(comments: CommentType[], parentId?: string) {
    // Сначала кэшируем пользователей с их ролями
    this.cacheUsersFromComments(comments);
    
    // Затем добавляем комментарии
    comments.forEach(comment => {
      this.addComment(comment, parentId);
    });
  }

  /**
   * Универсальный метод для загрузки комментариев 
   * (как для постов, так и для комментариев)
   */
  loadComments = (
    parentId: string,
    limit: number = 10,
    page: number = 1,
    sort?: 'date' | 'likes',
    isComment: boolean = false
  ): Promise<void> => {
    // Создаем уникальный ключ для отслеживания активных запросов
    const requestKey = `${parentId}-${page}-${sort || this.sort}`;
    
    // Проверяем, идёт ли уже такой запрос
    if (this.activeRepliesRequests.get(requestKey)) {
      logger.log(`[CommentStore] Request for ${requestKey} already active, skipping duplicate`);
      return Promise.resolve();
    }
    
    // Отмечаем запрос как активный
    this.activeRepliesRequests.set(requestKey, true);
    
    this.setLoadingReplies(parentId, true);
    
    logger.log(`[CommentStore] loadComments ${isComment ? 'comment' : 'post'} ${parentId}, page ${page}, limit ${limit}`);

    // Создаем уникальный ключ для этого запроса
    const cacheKey = `${parentId}-${page}-${limit}-${sort || this.sort}-${isComment}`;
    
    // Проверяем, есть ли уже активный запрос с такими параметрами
    if (this.loadCommentsPromises.has(cacheKey)) {
      logger.log(`[CommentStore] Reusing existing loadComments promise for ${cacheKey}`);
      return this.loadCommentsPromises.get(cacheKey)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const socketClient = this.socketStore.comments;
      if (!socketClient) {
        this.setLoadingReplies(parentId, false);
        reject(new Error('Comments socket not available'));
        return;
      }
      
      const payload = {
        parentId,
        page,
        limit,
        sort: sort || this.sort
      };

      logger.log(`[CommentStore] Sending fetchComments w/ payload:`, payload);

      socketClient.emit(
        "fetchComments",
        payload,
        (response: FetchCommentsResponse) => {
          this.setLoadingReplies(parentId, false);
          
          if (response?.error) {
            logger.error(`[CommentStore] Error: ${response.error}`);
            reject(new Error(response.error));
            return;
          }
          
          const comments = response?.comments || [];
          const totalCount = response?.total || 0;
          
          logger.log(`[CommentStore] Get ${comments.length} for parentId ${parentId}, total: ${totalCount}`);
          
          runInAction(() => {
            const processedComments = comments.map(comment => ({
              ...comment,
              userName: comment.userName || comment.user?.userName || '',
            }));
            
            // Используем processComments для кэширования пользователей
            this.processComments(processedComments, isComment ? parentId : undefined);
            
            if (isComment) {
              // Для ответов на комментарии сохраняем в repliesMap
              this.updateCommentCollection(this.repliesMap, parentId, processedComments, page === 1);
              this.repliesShownMap.set(parentId, true);
            } else {
              // Для постов сохраняем в commentsMap
              this.updateCommentCollection(this.commentsMap, parentId, processedComments, page === 1);
              this.totalItemsMap.set(parentId, totalCount);
            }
            
            this.lastUpdateTimeMap.set(parentId, Date.now());
          });
          
          // Удаляем промис из кэша
          this.loadCommentsPromises.delete(cacheKey);
          resolve();
        });
    }).finally(() => {
      // Помечаем запрос как завершенный
      this.activeRepliesRequests.set(requestKey, false);
    });

    // Сохраняем промис в кэше
    this.loadCommentsPromises.set(cacheKey, promise);
    return promise;
  };

  /**
   * Методы для сохранения состояния комментариев при навигации
   */
  saveCommentState = action((scrollPosition: number, commentId: string) => {
    this.commentScrollPosition = scrollPosition;
    if (commentId) {
      const replies = this.getReplies(commentId);
      this.savedCommentReplies = [...replies];
    }
  });

  restoreCommentState = action((commentId: string) => {
    if (this.commentStateRestored || !commentId) return;
    
    if (this.savedCommentReplies.length > 0) {
      this.repliesMap.set(commentId, observable(this.savedCommentReplies));
    }
    
    this.commentStateRestored = true;
  });
  
  onBackToComment = action((scrollTo: (position: number) => void) => {
    const scrollPosition = this.commentScrollPosition;
    setTimeout(() => scrollTo(scrollPosition), 250);
  });

  /**
   * Вспомогательный метод для определения типа ID
   */
  private isPostId(id: string): boolean {
    // Определяем пост по длине UUID (36 символов) и 4 дефисам
    return id.length === 36 && (id.match(/-/g) || []).length === 4;
  }
  
  /**
   * Вспомогательный метод для обновления коллекции комментариев
   */
  private updateCommentCollection(
    collection: typeof this.commentsMap | typeof this.repliesMap,
    parentId: string,
    newComments: CommentType[],
    clearExisting: boolean
  ): void {
    // Process comments to ensure they have proper structure
    const processedComments = newComments.map(comment => ({
      ...comment,
      userName: comment.userName || comment.user?.userName || '',
    }));

    const existingComments = collection.get(parentId) || [];
    
    if (clearExisting) {
      collection.set(parentId, processedComments.map(c => observable(c)));
    } else {
      const existingIds = new Set(existingComments.map(c => c.id));
      const uniqueNewComments = processedComments.filter(c => !existingIds.has(c.id));
      
      if (uniqueNewComments.length > 0 || existingComments.length === 0) {
        collection.set(parentId, [
          ...existingComments,
          ...uniqueNewComments.map(c => observable(c))
        ]);
      }
    }
  }
  
  /**
   * Загружает следующую страницу комментариев
   */
  loadMoreComments = (parentId: string, limit: number = 10): Promise<void> => {
    logger.log(`[CommentStore] Loading more comments for ${parentId}`);
    
    const isPost = this.isPostId(parentId);
    const comments = isPost 
      ? this.getComments(parentId) 
      : this.getReplies(parentId);
      
    const page = Math.floor(comments.length / limit) + 1;
    
    return this.loadComments(parentId, limit, page, undefined, !isPost);
  };
  
  /**
   * Переключает отображение ответов и при необходимости загружает их
   */
  toggleRepliesShown = (itemId: string): void => {
    const currentState = this.repliesShownMap.get(itemId) || false;
    logger.log(`[CommentStore] Toggling nested replies shown for ${itemId}: ${currentState} -> ${!currentState}`);
    
    // Устанавливаем новое состояние
    this.repliesShownMap.set(itemId, !currentState);
    
    // Если показываем впервые и нет данных - загружаем
    if (!currentState && (!this.repliesMap.has(itemId) || this.repliesMap.get(itemId)?.length === 0)) {
      this.loadComments(itemId, 10, 1, undefined, true);
    }
  };
  
  /**
   * Обработчик нового комментария
   */
handleNewComment = ({ postId, comment }: { postId: string; comment: CommentType }) => {
  // Делаем копию комментария для дальнейшей обработки
  const processedComment: CommentType = {
    ...comment,
    userName: comment.userName || comment.user?.userName || '',
  };

  // Проверка и восстановление данных пользователя из кэша
  if (processedComment.userId && (!processedComment.user || !processedComment.user.userName)) {
    const cachedUser = this.userStore.getCachedUser(processedComment.userId);
    if (cachedUser) {
      processedComment.user = cachedUser;
      processedComment.userName = cachedUser.userName;
      logger.log(`[CommentStore] Restored user data for comment ${processedComment.id} from cache: ${cachedUser.userName}`);
    } else {
      // Если пользователя нет в кэше, запрашиваем его данные
      this.userStore.getUserById(processedComment.userId).then(user => {
        if (user) {
          // Находим комментарий во всех коллекциях и обновляем данные пользователя
          this.updateCommentUserData(processedComment.id, user);
          logger.log(`[CommentStore] Fetched and updated user data for comment ${processedComment.id}: ${user.userName}`);
        }
      });
    }
  }

  // Если это комментарий к комментарию (не к посту)
  if (processedComment.parentId) {
    // Добавляем в коллекцию ответов родительского комментария
    const existingReplies = this.repliesMap.get(processedComment.parentId) || [];
    const replyExists = existingReplies.some(reply => reply.id === processedComment.id);
    
    if (!replyExists) {
      const updatedReplies = [processedComment, ...existingReplies];
      this.repliesMap.set(processedComment.parentId, updatedReplies);
      logger.log(`[CommentStore] New reply ${processedComment.id} to comment ${processedComment.parentId}`);
      
      // Обновляем счетчик ответов для родительского комментария
      const parentComment = this.getItemById(processedComment.parentId);
      if (parentComment) {
        parentComment.repliesCount = (parentComment.repliesCount || 0) + 1;
      }
      
      // Обновляем общий счетчик комментариев для поста
       if (processedComment.postId) {
        const currentPostTotal = this.totalItemsMap.get(processedComment.postId) || 0;
        const newTotal = currentPostTotal + 1;
        logger.log(`[CommentStore] Updating comment count for post ${processedComment.postId}: ${currentPostTotal} → ${newTotal}`);
        this.totalItemsMap.set(processedComment.postId, newTotal);
        
        // Call update in PostStore
        if (this.postStore) {
          this.updatePostCommentCount(processedComment.postId);
        } else {
          logger.error(`[CommentStore] Cannot update PostStore: postStore is ${this.postStore}`);
        }
      }
    }
  } 
  // Если это комментарий к посту
  else {
    logger.log(`[CommentStore] New comment ${processedComment.id} for post ${processedComment.postId}`);
    const existingComments = this.commentsMap.get(postId) || [];
    const commentExists = existingComments.some(c => c.id === processedComment.id);
    
    if (!commentExists) {
      // Добавляем комментарий в начало списка
      const updatedComments = [processedComment, ...existingComments];
      this.commentsMap.set(postId, updatedComments);
      
      // Обновляем счетчик общего количества комментариев
      const currentTotal = this.totalItemsMap.get(postId) || 0;
      const newTotal = currentTotal + 1;
      logger.log(`[CommentStore] Updating comment count for post ${postId}: ${currentTotal} → ${newTotal}`);
      this.totalItemsMap.set(postId, newTotal);
      
      // Update the count in PostStore
      if (this.postStore) {
        this.updatePostCommentCount(postId);
      } else {
        logger.error(`[CommentStore] Cannot update PostStore: postStore is ${this.postStore}`);
      }
    }
  }
};

// Обновляем счетчик комментариев в PostStore
private updatePostCommentCount(postId: string): void {
  if (!this.postStore) {
    logger.warn(`[CommentStore] PostStore not available for updating comment count`);
    return;
  }
  
  // Get the current total from our store
  const currentTotal = this.totalItemsMap.get(postId) || 0;
  
  try {
    // Log before updating
    logger.log(`[CommentStore] Calling PostStore.updatePostCommentCount(${postId}, ${currentTotal})`);
    
    // Update the count in PostStore
    this.postStore.updatePostCommentCount(postId, currentTotal);
    
    logger.log(`[CommentStore] Successfully updated post ${postId} comment count to ${currentTotal} in PostStore`);
  } catch (error) {
    logger.error(`[CommentStore] Failed to update post comment count: ${error}`);
  }
}
/**
 * Обновляет данные пользователя во всех комментариях 
 */
updateCommentUserData = (commentId: string, user: User) => {
  // Обновляем в commentsMap
  for (const [postId, comments] of this.commentsMap.entries()) {
    const index = comments.findIndex(c => c.id === commentId);
    if (index >= 0) {
      comments[index].user = user;
      comments[index].userName = user.userName;
      this.commentsMap.set(postId, [...comments]);
      break;
    }
  }

  // Обновляем в repliesMap  
  for (const [parentId, replies] of this.repliesMap.entries()) {
    const index = replies.findIndex(r => r.id === commentId);
    if (index >= 0) {
      replies[index].user = user;
      replies[index].userName = user.userName;
      this.repliesMap.set(parentId, [...replies]);
      break;
    }
  }
}
  /**
   * Обрабатывает события лайка и анлайка от сервера
   */
  handleLikeEvent = (data: {
    commentId: string;
    userId: string;
    newLikeCount: number;
    likedUserIds: string[];
    type: 'like' | 'unlike';
  }) => {
    const { commentId, userId, newLikeCount, likedUserIds, type } = data;
    
    logger.log(`[CommentStore] Comment ${commentId} ${type === 'like' ? 'liked' : 'unliked'} by ${userId}, new count: ${newLikeCount}`);
    
    // Обновляем данные комментария
    this.updateCommentLikeState(commentId, newLikeCount, likedUserIds);
  }
  
  /**
   * Обновляет состояние лайков комментария
   */
  private updateCommentLikeState(commentId: string, likes: number, likedUserIds: string[], skipResort: boolean = false): void {
    const comment = this.getItemById(commentId);
    if (!comment) {
      logger.warn(`[CommentStore] Comment ${commentId} not found when updating like state`);
      return;
    }
    
    runInAction(() => {
      comment.likes = likes;
      comment.likedUserIds = likedUserIds;
      
      // Обновляем комментарий во всех коллекциях
      this.updateCommentInCollections(comment);
    });
    
    // Пересортировываем только если нужно и если активна сортировка по лайкам
    if (!skipResort && this.sort === 'likes') {
      this.reSortComments(comment);
    }
  }
  
  /**
   * Обновляет комментарий во всех коллекциях
   */
  private updateCommentInCollections(comment: CommentType): void {
    // Обновляем в коллекции commentsMap
    if (comment.postId) {
      const comments = this.commentsMap.get(comment.postId) || [];
      const index = comments.findIndex(c => c.id === comment.id);
      if (index >= 0) {
        comments[index] = { ...comment };
        this.commentsMap.set(comment.postId, [...comments]);
      }
    }
    
    // Обновляем в коллекции repliesMap
    if (comment.parentId) {
      const replies = this.repliesMap.get(comment.parentId) || [];
      const index = replies.findIndex(r => r.id === comment.id);
      if (index >= 0) {
        replies[index] = { ...comment };
        this.repliesMap.set(comment.parentId, [...replies]);
      }
    }
  }

  /**
   * Пересортировывает коллекции комментариев
   */
  reSortComments = (comment: CommentType) => {
    const postId = comment.postId;
    if (this.commentsMap.has(postId)) {
      const comments = this.commentsMap.get(postId) || [];
      const sortedComments = this.applySorting([...comments]);
      this.commentsMap.set(postId, sortedComments);
    }

    if (comment.parentId && this.repliesMap.has(comment.parentId)) {
      const replies = this.repliesMap.get(comment.parentId) || [];
      const sortedReplies = this.applySorting([...replies]);
      this.repliesMap.set(comment.parentId, sortedReplies);
    }
  };

  /**
   * Переключает лайк на комментарии
   */
  toggleLike = action((commentId: string, userId: string) => {
    const comment = this.getItemById(commentId);
    if (!comment) return;

    const isLiked = this.isItemLikedByUser(comment, userId);
    
    // Оптимистично обновляем UI без ожидания ответа сервера
    const newLikes = isLiked ? Math.max(0, (comment.likes || 0) - 1) : (comment.likes || 0) + 1;
    const newLikedUserIds = isLiked
      ? comment.likedUserIds?.filter(id => id !== userId) || []
      : [...(comment.likedUserIds || []), userId];
      
    // Обновляем состояние лайка
    this.updateCommentLikeState(commentId, newLikes, newLikedUserIds, true);
    
    // Отправляем событие на сервер
    if (!this.socketStore.comments) {
      logger.log("[CommentStore] Cannot emit like event: socket not available");
      return;
    }

    const event = isLiked ? "unlikeComment" : "likeComment";
    this.socketStore.comments.emit(event, { commentId });
  });
  
  /**
   * Создает новый комментарий
   */
  createComment = (postId: string, content: string, parentId?: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const socketClient = this.socketStore.comments;
      if (!socketClient) {
        resolve(false);
        return;
      }
      
      // Для индикации загрузки
      const targetId = parentId || postId;
      this.setLoadingReplies(targetId, true);
      
      socketClient.emit(
        'addComment',
        { postId, content, parentId },
        (response: { success: boolean }) => {
          this.setLoadingReplies(targetId, false);
          
          if (response && response.success) {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      );
    });
  };

  /**
   * Устанавливает ответы на комментарий
   */
  setReplies = action((itemId: string, replies: CommentType[]) => {
    logger.log(`[CommentStore] Setting ${replies.length} replies for ${itemId}`);
    runInAction(() => {
      this.repliesMap.set(itemId, replies.map(r => observable(r)));
    });
  });
  
  /**
   * Устанавливает статус отображения ответов
   */
  setRepliesShown = action((itemId: string, shown: boolean) => {
    logger.log(`[CommentStore] Setting replies shown for ${itemId}: ${shown}`);
    runInAction(() => {
      this.repliesShownMap.set(itemId, shown);
    });
  });
  
  /**
   * Устанавливает статус загрузки ответов
   */
  setLoadingReplies = action((itemId: string, loading: boolean) => {
    logger.log(`[CommentStore] Setting loading state for ${itemId}: ${loading}`);
    runInAction(() => {
      this.loadingRepliesMap.set(itemId, loading);
    });
  });
  
  /**
   * Устанавливает комментарии к посту
   */
  setComments = action((postId: string, comments: CommentType[]) => {
    runInAction(() => {
      const sortedComments = this.applySorting(comments);
      this.commentsMap.set(postId, sortedComments);
    });
  });
  
  /**
   * Находит комментарий по ID
   */
  getItemById(commentId: string): CommentType | undefined {
    return this.getCommentById(commentId);
  }
  
  /**
   * Возвращает ответы на комментарий
   */
  getReplies(itemId: string): CommentType[] {
    return this.repliesMap.get(itemId) || [];
  }
  
  /**
   * Проверяет, отображаются ли ответы на комментарий
   */
  isRepliesShown(itemId: string): boolean {
    return this.repliesShownMap.get(itemId) || false;
  }
  
  /**
   * Проверяет, загружаются ли ответы на комментарий
   */
  isLoadingReplies(itemId: string): boolean {
    return this.loadingRepliesMap.get(itemId) || false;
  }
  
  /**
   * Возвращает общее количество комментариев для поста
   */
  getTotalComments(postId: string): number {
    const total = this.totalItemsMap.get(postId) || 0;
    logger.log(`[CommentStore]: getTotalComments(${postId}) = ${total}`);
    return total;
  }

  /**
   * Возвращает комментарии к посту
   */
  getComments(postId: string): CommentType[] {
    const comments = this.commentsMap.get(postId) || [];
    return this.applySorting([...comments]);
  }

  /**
   * Получает комментарий по ID
   */
getCommentById(commentId: string): CommentType | undefined {
  // Сначала ищем в комментариях ко всем постам
  for (const [, comments] of this.commentsMap.entries()) {
    const found = comments.find(comment => comment.id === commentId);
    if (found) return found;
  }
  
  // Затем ищем во всех ответах
  for (const replies of this.repliesMap.values()) {
    const found = replies.find(reply => reply.id === commentId);
    if (found) return found;
  }
  
  return undefined;
}

  /**
   * Получает комментарий по slug
   */

getCommentBySlug(slug: string, logWarning: boolean = true): CommentType | null {
  if (logWarning) {
    logger.log(`[CommentStore] Searching for comment by slug: ${slug}`);
  }
  
  for (const [postId, comments] of this.commentsMap.entries()) {
    if (logWarning) {
      logger.log(`[CommentStore] Searching in post ${postId}, ${comments.length} comments`);
    }
    for (const comment of comments) {
      if (logWarning) {
        logger.log(`[CommentStore] Checking comment: id=${comment.id}, slug=${comment.slug}`);
      }
      if (comment.slug === slug || comment.id === slug) {
        logger.log(`[CommentStore] Found comment by ${comment.slug === slug ? 'slug' : 'id'}: ${comment.id}`);
        return comment;
      }
    }
  }
  
  for (const [parentId, replies] of this.repliesMap.entries()) {
    if (logWarning) {
      logger.log(`[CommentStore] Searching in replies for ${parentId}, ${replies.length} replies`);
    }
    for (const reply of replies) {
      if (logWarning) {
        logger.log(`[CommentStore] Checking reply: id=${reply.id}, slug=${reply.slug}`);
      }
      if (reply.slug === slug || reply.id === slug) {
        logger.log(`[CommentStore] Found reply by ${reply.slug === slug ? 'slug' : 'id'}: ${reply.id}`);
        return reply;
      }
    }
  }
  
  if (logWarning) {
    logger.warn(`[CommentStore] Comment with slug ${slug} not found`);
  }
  return null;
}

  /**
   * Получает комментарий по slug из API
   */
  fetchCommentBySlug = action(async (slug: string): Promise<CommentType | null> => {
    logger.log(`[CommentStore] Fetching comment by slug: ${slug}`);
    
    // Проверяем, есть ли комментарий в кэше
    const cachedComment = this.getCommentBySlug(slug, false);
    if (cachedComment) {
      logger.log(`[CommentStore] Comment with slug ${slug} found in cache`);
      
      // Убедимся, что у комментария есть postId
      if (!cachedComment.postId) {
        logger.warn(`[CommentStore] Comment with slug ${slug} is missing postId, trying to fetch complete data`);
      } else {
        return cachedComment;
      }
    }

    // Проверка наличия активного запроса
    if (this.fetchCommentPromises.has(slug)) {
      logger.log(`[CommentStore] Reusing existing fetch promise for slug ${slug}`);
      return this.fetchCommentPromises.get(slug)!;
    }

    try {
      // Проверяем доступность сокета
      if (!this.socketStore.comments || !this.socketStore.comments.connected) {
        logger.warn('[CommentStore] Comments socket not connected, waiting...');
        await this.waitForSocketConnection();
      }

      // Создаем промис для запроса
      const fetchPromise = new Promise<CommentType | null>((resolve) => {
        this.socketStore.comments!.emit(
          "fetchCommentBySlug",
          { slug },
          (response: FetchCommentBySlugResponse) => {
            logger.log(`[CommentStore] Received response for fetchCommentBySlug(${slug})`);
            
            // Извлекаем комментарий из ответа
            const comment = this.extractCommentFromResponse(response);

            if (comment) {
              // Кэшируем пользователя
              if (comment.user) {
                this.userStore.addCachedUser(comment.user);
              }
              
              // ДОБАВЛЯЕМ В КОЛЛЕКЦИИ
              runInAction(() => {
                if (comment.postId) {
                  // Это комментарий к посту - добавляем в commentsMap
                  const existingComments = this.commentsMap.get(comment.postId) || [];
                  if (!existingComments.find(c => c.id === comment.id)) {
                    existingComments.push(comment);
                    this.commentsMap.set(comment.postId, existingComments);
                  }
                  logger.log(`[CommentStore] Added comment to post ${comment.postId} commentsMap`);
                } else if (comment.parentId) {
                  // Это ответ на комментарий - добавляем в repliesMap
                  const existingReplies = this.repliesMap.get(comment.parentId) || [];
                  if (!existingReplies.find(r => r.id === comment.id)) {
                    existingReplies.push(comment);
                    this.repliesMap.set(comment.parentId, existingReplies);
                  }
                  logger.log(`[CommentStore] Added reply to comment ${comment.parentId} repliesMap`);
                }
              });
              
              resolve(comment);
            } else {
              logger.warn(`[CommentStore] No comment found for slug: ${slug}`);
              resolve(null);
            }
            
            // Удаляем промис из кэша
            this.fetchCommentPromises.delete(slug);
          }
        );
      });
      
      // Сохраняем промис в кэше
      this.fetchCommentPromises.set(slug, fetchPromise);
      return fetchPromise;
    } catch (error) {
      logger.error('[CommentStore] Error fetching comment by slug:', error);
      this.fetchCommentPromises.delete(slug);
      return null;
    }
  });

  /**
   * Вспомогательный метод для ожидания подключения сокета
   */
  private async waitForSocketConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkSocketInterval = setInterval(() => {
        attempts++;
        if (this.socketStore.comments && this.socketStore.comments.connected) {
          clearInterval(checkSocketInterval);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkSocketInterval);
          reject(new Error('Socket connection timeout'));
        }
      }, 100);
    });
  }

  /**
   * Вспомогательный метод для извлечения комментария из ответа API
   */
  private extractCommentFromResponse(response: FetchCommentBySlugResponse | CommentType[] | unknown): CommentType | null {
    if (!response) return null;
    
    // Check if it's a FetchCommentBySlugResponse
    if (typeof response === 'object' && response !== null) {
      const maybeResponse = response as Partial<FetchCommentBySlugResponse>;
      
      if (maybeResponse.comment) {
        return maybeResponse.comment;
      }
      
      if (maybeResponse.comments && maybeResponse.comments.length > 0) {
        return maybeResponse.comments[0];
      }
    }
    
    // Check if it's an array of comments
    if (Array.isArray(response) && response.length > 0) {
      return response[0] as CommentType;
    }
    
    return null;
  }

  /**
   * Получает комментарии для поста по его slug
   */
  loadCommentsBySlug = action(async (entitySlug: string, limit: number = 10, page: number = 1, 
                                  sort?: 'date' | 'likes', isComment?: boolean): Promise<void> => {
  logger.log(`[CommentStore] Loading comments by slug: ${entitySlug}, isComment: ${isComment}`);
  
    return this.fetchCommentsBySlug(entitySlug, limit, page, sort, isComment ?? false);
  });

  /**
   * Метод для прямого запроса комментариев по slug
   */
  private async fetchCommentsBySlug(slug: string, limit: number = 10, page: number = 1, 
     sort?: 'date' | 'likes', isComment: boolean = false): Promise<void> {
    if (!this.socketStore.comments?.connected) {
      throw new Error('Comments socket not connected');
    }
    
    const event = isComment ? 'fetchRepliesBySlug' : 'fetchCommentsBySlug';
    const payload = {
      slug,
      page,
      limit,
      sort: sort || this.sort
    };
    
    logger.log(`[CommentStore] Emitting ${event} with payload:`, payload);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${event} response`));
      }, 10000);
      
      this.socketStore.comments!.emit(event, payload, (response: FetchCommentsResponse) => {
        clearTimeout(timeout);
        
        if (!response) {
          logger.error(`[CommentStore] No response received for ${event}`);
          reject(new Error('No response received'));
          return;
        }
        
        if (response.error) {
          logger.error(`[CommentStore] Error in ${event}: ${response.error}`);
          reject(new Error(response.error));
          return;
        }

        const comments = response.comments || [];
        const totalCount = response.total || 0;
        
        logger.log(`[CommentStore] ${event} received ${comments.length} items for slug ${slug}`);
        
        if (comments.length === 0 && !isComment) {
          logger.log(`[CommentStore] No comments found for slug ${slug}`);
          resolve();
          return;
        }
        
        // Обработка полученных комментариев
        runInAction(() => {
          const processedComments = comments.map(comment => ({
            ...comment,
            userName: comment.userName || comment.user?.userName || '',
          }));
          
          // Если в ответе есть targetId, используем его
          const targetId = response.targetId || (isComment ? comments[0]?.parentId : comments[0]?.postId);
          
          if (targetId) {
            if (isComment) {
              this.updateCommentCollection(this.repliesMap, targetId, processedComments, page === 1);
              this.repliesShownMap.set(targetId, true);
            } else {
              this.updateCommentCollection(this.commentsMap, targetId, processedComments, page === 1);
              this.totalItemsMap.set(targetId, totalCount);
            }
            
            // Обрабатываем комментарии для кэширования пользователей
            this.processComments(processedComments, isComment ? targetId : undefined);
            
            logger.log(`[CommentStore] Updated ${isComment ? 'replies' : 'comments'} for ${targetId}`);
          } else {
            logger.warn(`[CommentStore] Could not determine target ID for comments with slug ${slug}`);
          }
        });
        
        resolve();
      });
    });
  }

  /**
   * Проверяет, есть ли комментарии для поста
   */
  hasCommentsForPost(postId: string): boolean {
    const comments = this.commentsMap.get(postId);
    return !!comments && comments.length > 0;
  }

  /**
   * Получает ответы на комментарий по его slug
   */
  getRepliesBySlug(commentSlug: string): CommentType[] {
    const comment = this.getCommentBySlug(commentSlug, false);
    if (!comment) {
      logger.warn(`[CommentStore] Comment with slug ${commentSlug} not found`);
      return [];
    }
    return this.getReplies(comment.id);
  }

  /**
   * Проверяет, отображаются ли ответы на комментарий по его slug
   */
  isRepliesShownBySlug(commentSlug: string): boolean {
    const comment = this.getCommentBySlug(commentSlug, false);
    if (!comment) return false;
    return this.isRepliesShown(comment.id);
  }

  /**
   * Устанавливает состояние отображения ответов на комментарий по его slug
   */
  setRepliesShownBySlug(commentSlug: string, shown: boolean) {
    const comment = this.getCommentBySlug(commentSlug, false);
    if (!comment) {
      logger.warn(`[CommentStore] Comment with slug ${commentSlug} not found`);
      return;
    }
    this.setRepliesShown(comment.id, shown);
  }
  /**
   * Реализация метода fetchComments из интерфейса ICommentStore
   * Этот метод - обертка над существующим loadComments
   */
  fetchComments = async (postId: string, page: number = 1): Promise<void> => {
    logger.log(`[CommentStore] fetchComments for post ${postId}, page ${page}`);
    
    // Делегируем выполнение существующему методу loadComments
    // loadComments(parentId, limit, page, sort, isComment)
    return this.loadComments(postId, 10, page, this.sort, false);
  };

  /**
   * Проверяет, загружены ли комментарии для поста
   */
  hasLoaded = (postId: string): boolean => {
    return this.commentsMap.has(postId);
  };

  /**
   * Получает текущую страницу комментариев для поста
   */
  getCurrentPage = (postId: string): number => {
    const comments = this.getComments(postId);
    return Math.ceil(comments.length / 10); // Используем стандартный размер страницы
  };

  /**
   * Проверяет, загружаются ли комментарии для поста
   */
  isLoading = (postId: string): boolean => {
    return this.loadingRepliesMap.get(postId) || false;
  };
  clearComments = action("clearComments", (postId: string): void => {
    logger.log(`[CommentStore] Clearing comments for post ${postId}`);
    this.commentsMap.set(postId, []);
  });

  // Очистка ответов для комментария - БЕЗ ДЕКОРАТОРА  
  clearReplies = action("clearReplies", (commentId: string): void => {
    logger.log(`[CommentStore] Clearing replies for comment ${commentId}`);
    this.repliesMap.set(commentId, []);
  });

  /**
   * Устанавливает способ сортировки комментариев
   */
  setSort = action((newSort: 'date' | 'likes') => {
    if (this.sort === newSort) return;
    
    logger.log(`[CommentStore] Changing sort from ${this.sort} to ${newSort}`);
    this.sort = newSort;
    
    // Пересортируем все коллекции
    this.applySortToAllCollections();
  });

  getTotalReplies(commentId: string): number {
    const total = this.totalItemsMap.get(commentId) || this.getReplies(commentId).length;
    logger.log(`[CommentStore]: getTotalReplies(${commentId}) = ${total}`);
    return total;
  }
  
  /**
   * Освобождает ресурсы при уничтожении
   */
  override dispose() {
    if (this.socketStore.comments) {
      this.socketStore.comments.off("newComment", this.handleNewComment);
      this.socketStore.comments.off("commentLiked");
      this.socketStore.comments.off("commentUnliked");
    }
  }
}

export default CommentStore;