import { action, makeObservable, observable, runInAction, computed, reaction } from "mobx";
import { socketStore } from "./SocketStore";
import { Comment as CommentType } from "../../types/interfaces";
import { logger } from '../../utils/Logger';
import { BaseStore } from "./BaseStore";
import io from "socket.io-client";
import userStore from "./UserStore";


// Интерфейс для ответа от fetchComments события
interface FetchCommentsResponse {
  comments?: CommentType[];
  total?: number;
  error?: string;
}
  interface FetchCommentBySlugResponse {
    comment?: CommentType;
    comments?: CommentType[];
    error?: string;
  }
  
/**
 * Хранилище для управления комментариями
 */
class CommentStore extends BaseStore<CommentType> {
  // Карты для хранения данных
  commentsMap = observable.map<string, CommentType[]>();
  repliesMap = observable.map<string, CommentType[]>();
  repliesShownMap = observable.map<string, boolean>();
  loadingRepliesMap = observable.map<string, boolean>();
  private lastUpdateTimeMap = new Map<string, number>();
  private loadCommentsPromises = new Map<string, Promise<void>>();

  // Состояние для страницы комментариев
  commentScrollPosition: number = 0;
  commentStateRestored: boolean = false;
  savedCommentReplies: Array<CommentType> = [];

  constructor() {
    super();
    makeObservable(this, {
      commentsMap: observable,
      repliesMap: observable,
      repliesShownMap: observable,
      loadingRepliesMap: observable,
      sortedComments: computed,
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
      toggleLike: action
    });
    
    this.setupSocketListeners();
  }
  private fetchCommentPromises = new Map<string, Promise<CommentType | null>>();

  /**
   * Настраивает слушателей socket-событий
   */
  setupSocketListeners = () => {
    if (!socketStore.comments) {
      logger.log("[CommentStore] socket not available, will set up listeners when connection is established");
      
      // Наблюдаем за изменением socketStore.comments и устанавливаем обработчики, когда он станет доступен
      const disposer = reaction(
        () => socketStore.comments,
        (commentsSocket) => {
          if (commentsSocket) {
            this.setupSocketHandlers(commentsSocket);
            disposer(); // Прекращаем наблюдение, когда установили обработчики
          }
        }
      );
      
      return;
    }
    
    this.setupSocketHandlers(socketStore.comments);
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
    
    logger.log("[CommentStore] socket handlers setup complete");
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
  protected applySortToAllCollections(): void {
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

  addComment = action((comment: CommentType, parentId?: string): void => {
  // Проверяем наличие обязательных полей перед кэшированием
    if (comment.user && comment.user.id && comment.user.userName) {
      userStore.addCachedUser(comment.user);
    }
    
    // Если нет user объекта, но есть userId, пробуем восстановить из кэша
    if (!comment.user && comment.userId) {
      const cachedUser = userStore.getCachedUser(comment.userId);
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
  private processComments(comments: CommentType[], parentId?: string) {
    comments.forEach(comment => {
      // Проверяем наличие обязательных полей перед кэшированием
      if (comment.user && comment.user.id && comment.user.userName) {
        userStore.addCachedUser(comment.user);
      }
      
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
    const socketClient = socketStore.comments;
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
  });

  // Сохраняем промис в кэше
  this.loadCommentsPromises.set(cacheKey, promise);
  return promise;
};
  // Методы для сохранения состояния
  saveCommentState(scrollPosition: number, commentId: string) {
    this.commentScrollPosition = scrollPosition;
    if (commentId) {
      const replies = this.getReplies(commentId);
      this.savedCommentReplies = [...replies];
    }
  }

  restoreCommentState(commentId: string) {
    if (this.commentStateRestored || !commentId) return;
    
    if (this.savedCommentReplies.length > 0) {
      this.repliesMap.set(commentId, observable(this.savedCommentReplies));
    }
    
    this.commentStateRestored = true;
  }
  
  onBackToComment(scrollTo: (position: number) => void) {
    const scrollPosition = this.commentScrollPosition;
    setTimeout(() => scrollTo(scrollPosition), 250);
  }

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
    logger.log(`Loading more comments for ${parentId}`);
    
    const isPost = this.isPostId(parentId);
    const comments = isPost 
      ? this.getComments(parentId) 
      : this.getReplies(parentId);
      
    const page = Math.floor(comments.length / limit) + 1;
    
    return this.loadComments(parentId, limit, page);
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
      this.loadComments(itemId, 10);
    }
  };
  
  /**
   * Обработчик нового комментария
   */
/**
 * Обработчик нового комментария
 */
  handleNewComment = ({ postId, comment }: { postId: string; comment: CommentType }) => {

    // Очищаем структуру комментария от избыточных данных
    const processedComment: CommentType = {
      ...comment,
      // Извлекаем userName из вложенного объекта user, если он есть
      userName: comment.userName || comment.user?.userName || '',
    };

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
        this.totalItemsMap.set(postId, currentTotal + 1);
      }
    }
  };

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
  toggleLike(commentId: string, userId: string) {
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
    if (!socketStore.comments) {
      logger.log("[CommentStore] Cannot emit like event: socket not available");
      return;
    }

    const event = isLiked ? "unlikeComment" : "likeComment";
    socketStore.comments.emit(event, { commentId });
  }
  
  /**
   * Создает новый комментарий
   */
  createComment = (postId: string, content: string, parentId?: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const socketClient = socketStore.comments;
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
  setReplies = (itemId: string, replies: CommentType[]) => {
    logger.log(`Setting ${replies.length} replies for ${itemId}`);
    runInAction(() => {
      this.repliesMap.set(itemId, replies.map(r => observable(r)));
    });
  };
  
  /**
   * Устанавливает статус отображения ответов
   */
  setRepliesShown = (itemId: string, shown: boolean) => {
    logger.log(`[CommentStore] Setting replies shown for ${itemId}: ${shown}`);
    runInAction(() => {
      this.repliesShownMap.set(itemId, shown);
    });
  };
  
  /**
   * Устанавливает статус загрузки ответов
   */
  setLoadingReplies = (itemId: string, loading: boolean) => {
    logger.log(`[CommentStore] Setting loading state for ${itemId}: ${loading}`);
    runInAction(() => {
      this.loadingRepliesMap.set(itemId, loading);
    });
  };
  
  /**
   * Устанавливает комментарии к посту
   */
  setComments = (postId: string, comments: CommentType[]) => {
    runInAction(() => {
      const sortedComments = this.applySorting(comments);
      this.commentsMap.set(postId, sortedComments);
    });
  };
  
  /**
   * Находит комментарий по ID
   */
  getItemById(commentId: string): CommentType | undefined {
    for (const comments of this.commentsMap.values()) {
      const comment = comments.find(c => c.id === commentId);
      if (comment) return comment;
    }
    
    for (const replies of this.repliesMap.values()) {
      const comment = replies.find(c => c.id === commentId);
      if (comment) return comment;
    }
    
    return undefined;
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
    logger.log(`[CommentStore] GetComments for ${postId}: found ${comments.length} hits`);
    return comments;
  }


  /**
   * Получает комментарий по ID
   */
  fetchComment = (commentId: string): Promise<CommentType | null> => {
    logger.log(`Fetching comment with ID: ${commentId}`);
    
    // Проверяем кэш сначала
    const existingComment = this.getCommentById(commentId);
    if (existingComment) {
      logger.log(`[CommentStore] Comment ${commentId} found in cache, returning`);
      return Promise.resolve(existingComment);
    }
    
    return new Promise<CommentType | null>((resolve) => {
      if (!socketStore.comments) {
        logger.error('[CommentStore] Comments socket not available');
        resolve(null);
        return;
      }
      
      socketStore.comments.emit(
        "fetchComments",
        { parentId: commentId, limit: 1 },
        (res: FetchCommentsResponse) => {
          if (!res || res.error || !res.comments?.length) {
            logger.warn(`[CommentStore] Comment ${commentId} not found`);
            resolve(null);
            return;
          }
          
          const comment = res.comments[0];
          this.addComment(comment);
          resolve(comment);
        }
      );
    });
  };
  
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

  getCommentBySlug(slug: string): CommentType | null {
    logger.log(`[CommentStore] Searching for comment by slug: ${slug}`);
    
    // Ищем среди всех комментариев ко всем постам
    for (const comments of this.commentsMap.values()) {
      const found = comments.find(comment => comment.slug === slug);
      if (found) {
        logger.log(`[CommentStore] Found comment in commentsMap: ${found.id}`);
        return found;
      }
    }

    // Ищем среди всех ответов
    for (const replies of this.repliesMap.values()) {
      const found = replies.find(reply => reply.slug === slug);
      if (found) {
        logger.log(`[CommentStore] Found comment in repliesMap: ${found.id}`);
        return found;
      }
    }

    logger.warn(`[CommentStore] Comment with slug ${slug} not found`);
    return null;
  }
fetchCommentBySlug = action(async (slug: string): Promise<CommentType | null> => {
  logger.log(`[CommentStore] Fetching comment by slug: ${slug}`);
  
  // Проверяем, есть ли комментарий в кэше
  const cachedComment = this.getCommentBySlug(slug);
  if (cachedComment) {
    logger.log(`[CommentStore] Comment with slug ${slug} found in cache`);
    return cachedComment;
  }

  // Проверка наличия активного запроса
  if (this.fetchCommentPromises.has(slug)) {
    logger.log(`[CommentStore] Reusing existing fetch promise for slug ${slug}`);
    return this.fetchCommentPromises.get(slug)!;
  }

  // Добавляем проверку на доступность сокета и более надежное ожидание
  if (!socketStore.comments || !socketStore.comments.connected) {
    logger.warn('[CommentStore] Comments socket not available or not connected, waiting for connection...');
    try {
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkSocketInterval = setInterval(() => {
          attempts++;
          if (socketStore.comments && socketStore.comments.connected) {
            clearInterval(checkSocketInterval);
            logger.log('[CommentStore] Socket connected successfully after waiting');
            resolve();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkSocketInterval);
            logger.error('[CommentStore] Timed out waiting for socket');
            reject(new Error('Socket connection timeout'));
          }
        }, 100);
      });
    } catch (error) {
      logger.error('[CommentStore] Failed to establish socket connection:', error);
      return null;
    }
  }

  // Проверяем еще раз после ожидания
  if (!socketStore.comments || !socketStore.comments.connected) {
    logger.error('[CommentStore] Comments socket still not available after waiting');
    return null;
  }

  // вывод логов для отладки
  logger.log('[CommentStore] Emitting fetchCommentBySlug event with payload:', { slug });
  
  // Создаем и сохраняем промис
  const fetchPromise = new Promise<CommentType | null>((resolve) => {
    socketStore.comments!.emit(
      "fetchCommentBySlug",
      { slug },
      (response: FetchCommentBySlugResponse) => {
        logger.log(`[CommentStore] Received response for fetchCommentBySlug(${slug}):`, response);
        
        let comment: CommentType | null = null;
        
        if (response) {
          if (response.comment) {
            comment = response.comment;
          } else if (response.comments && response.comments.length > 0) {
            comment = response.comments[0];
          } else if (Array.isArray(response) && response.length > 0) {
            comment = response[0];
          }
        }

        if (comment) {
          logger.log(`[CommentStore] Successfully fetched comment: ${comment.id}`);
          runInAction(() => {
            this.addComment(comment!);
          });
          resolve(comment);
        } else {
          logger.warn(`[CommentStore] No comment found for slug: ${slug}`);
          resolve(null);
        }
        
        // Удаляем промис из кэша после завершения
        this.fetchCommentPromises.delete(slug);
      }
    );
  });
  
  //Сохраняем промис в кэше
  this.fetchCommentPromises.set(slug, fetchPromise);
  return fetchPromise;
});

hasCommentsForPost(postId: string): boolean {
  // Проверяем, есть ли запись для этого поста в кэше
  const comments = this.commentsMap.get(postId);
  
  // Если есть хотя бы один комментарий или была отправлена загрузка, возвращаем true
  return !!comments && comments.length > 0;
}
  override dispose() {
    if (socketStore.comments) {
      socketStore.comments.off("newComment", this.handleNewComment);
    }
  }
}

export const commentStore = new CommentStore();