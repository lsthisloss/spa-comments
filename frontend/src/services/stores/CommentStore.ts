import { action, observable, runInAction, reaction, makeObservable, AnnotationMapEntry, computed } from "mobx";
import { Comment as CommentType, FetchCommentsResponse, FetchCommentBySlugResponse, User } from "../../types/interfaces";
import { logger } from '../../utils/Logger';
import { BaseStore } from "./BaseStore";
import io from "socket.io-client";
import type SocketStore from "./SocketStore";
import type UserStore from "./UserStore";
import { ICommentStore } from "../../types/stores";
import type PostStore from "./PostStore";

/*
  Хранилище для управления комментариями
  Содержит методы для загрузки, добавления, сортировки и управления комментариями и ответами
*/

class CommentStore extends BaseStore<CommentType> implements ICommentStore {
  // Карты для хранения данных
  commentsMap = new Map<string, CommentType[]>();
  repliesMap = new Map<string, CommentType[]>();
  repliesShownMap = new Map<string, boolean>();
  loadingRepliesMap = new Map<string, boolean>();

  // Кэширование запросов и времени
  private loadCommentsPromises = new Map<string, Promise<void>>();
  private fetchCommentPromises = new Map<string, Promise<CommentType | null>>();
  private activeRepliesRequests = new Map<string, boolean>();

  // Счетчики для хранения общего количества комментариев и ответов
  private loadedCommentsFor = new Set<string>();
  private loadedRepliesFor = new Set<string>();
  private newCommentListeners: Map<string, (comment: CommentType) => void> = new Map();

  public hasLoadedCommentsFor(postId: string): boolean {
    return this.loadedCommentsFor.has(postId);
  }

  public hasLoadedRepliesFor(commentId: string): boolean {
    return this.loadedRepliesFor.has(commentId);
  }
  // Состояние для страницы комментариев
  commentScrollPosition: number = 0;
  commentStateRestored: boolean = false;
  savedCommentReplies: Array<CommentType> = [];
  currentComment = observable.box<CommentType | null>(null);

  // Инъектированные сторы
  private socketStore: SocketStore;
  private userStore: UserStore;
  private postStore: PostStore | null = null;

  constructor(socketStore: SocketStore, userStore: UserStore) {
    super();

    this.socketStore = socketStore;
    this.userStore = userStore;
    const annotations: Record<string, AnnotationMapEntry> = {
      // Observable properties
      commentsMap: observable,
      repliesMap: observable,
      repliesShownMap: observable,
      loadingRepliesMap: observable,
      commentScrollPosition: observable,
      commentStateRestored: observable,
      savedCommentReplies: observable,
      sortedCommentsMap: computed,
      sortedRepliesMap: computed,

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
      hasLoadedCommentsFor: action,
      hasLoadedRepliesFor: action,
      getItemById: action,
    };

    makeObservable(this, annotations);
    this.setupSocketListeners();
  }
  setPostStore(postStore: PostStore) {
    this.postStore = postStore;
  }

  /**
   * Настраивает слушателей socket-событий
   */
  setupSocketListeners = action(() => {
    if (!this.socketStore.comments) {
      const disposer = reaction(
        () => this.socketStore.comments,
        (commentsSocket) => {
          if (commentsSocket) {
            this.setupSocketHandlers(commentsSocket);
            disposer();
          }
        }
      );
      return;
    }

    this.setupSocketHandlers(this.socketStore.comments);
  });

  /*
    * Настраивает обработчики событий для сокета комментариев
    * Удаляет старые обработчики и добавляет новые
    */
  setupSocketHandlers(commentsSocket: ReturnType<typeof io>) {
    // Убираем старые обработчики
    commentsSocket.off("newComment");
    commentsSocket.off("commentLiked");
    commentsSocket.off("commentUnliked");

    // Обрабатываем новые комментарии
    commentsSocket.on("newComment", (response: { postId: string; comment: CommentType }) => {
      const { postId, comment } = response;

      if (!comment || !postId) {
        logger.error("[CommentStore] Invalid new comment response:", response);
        return;
      }

      logger.log("[CommentStore] New comment received", comment.id);
      this.handleNewComment({ ...comment, postId });
    });

    commentsSocket.on("commentLiked", (data: {
      commentId: string;
      userId: string;
      newLikeCount: number;
      likedUserIds: string[];
    }) => {
      logger.log("[CommentStore] Comment liked", data.commentId);
      this.handleLikeEvent({ ...data, type: 'like' });
    });

    commentsSocket.on("commentUnliked", (data: {
      commentId: string;
      userId: string;
      newLikeCount: number;
      likedUserIds: string[];
    }) => {
      logger.log("[CommentStore] Comment unliked", data.commentId);
      this.handleLikeEvent({ ...data, type: 'unlike' });
    });

    logger.log("[CommentStore] Socket handlers setup complete");
  }

  clearCurrentComment = action(() => {
    this.currentComment.set(null);
  });

  public applySortToAllCollections(): void {
    logger.log(`[CommentStore] applySortToAllCollections: no sorting applied`);
  }

  updatePostCommentCount = (postId: string, count?: number): void => {
    if (!this.postStore) {
      logger.warn('[CommentStore] PostStore reference not available for updating comment count');
      return;
    }

    // Используем count, если он передан, иначе считаем количество комментариев
    const actualCount = count !== undefined ? count : this.getComments(postId).length;

    logger.log(`[CommentStore] Calling PostStore.updatePostCommentCount(${postId}, ${actualCount})`);

    try {
      this.postStore.updatePostCommentCount(postId, actualCount);
      logger.log(`[CommentStore] Successfully updated post ${postId} comment count to ${actualCount} in PostStore`);
    } catch (error) {
      logger.error(`[CommentStore] Failed to update post comment count:`, error);
    }
  };

  setTotalComments = action((parentId: string, total: number): void => {
    this.totalItemsMap.set(parentId, total);
    logger.log(`[CommentStore] Manually set total for ${parentId}: ${total}`);
  });

  /*
    * Устанавливает комментарии для указанного ID
  */
  addComment = action((comment: CommentType, parentId?: string): void => {
    if (!comment.createdAt) {
      comment.createdAt = new Date().toISOString();
    }

    const targetId = parentId || comment.postId;
    if (!targetId) {
      logger.error("[CommentStore] Cannot add comment: no target ID");
      return;
    }

    // Создаем observable объект комментария
    const observableComment = observable(comment);
    // Если это ответ на комментарий, используем parentId
    if (parentId) {
      if (!this.repliesMap.has(parentId)) this.repliesMap.set(parentId, observable([])); // Сет чтобы не создавать дубликаты
      const replies = this.repliesMap.get(parentId)!; // Получаем массив ответов для parentId
      const idx = replies.findIndex(c => c.id === comment.id); // Ищем индекс комментария по ID
      if (idx >= 0) { // Если комментарий уже существует
        replies[idx] = observableComment; // Обновляем существующий комментарий
      } else {
        replies.push(observableComment); // иначе добавляем новый комментарий
      }
    } else if (comment.postId) { // Если это комментарий к посту
      if (!this.commentsMap.has(comment.postId)) this.commentsMap.set(comment.postId, observable([]));
      const comments = this.commentsMap.get(comment.postId)!;
      const idx = comments.findIndex(c => c.id === comment.id);
      if (idx >= 0) {
        comments[idx] = observableComment;
      } else {
        comments.push(observableComment);
      }
    }
  });

  // Маркирует комментарии или ответы как загруженные
  markAsLoaded = action("markAsLoaded", (targetId: string, isComment: boolean = false): void => {
    logger.log(`[CommentStore] Marking ${isComment ? 'replies' : 'comments'} for ${targetId} as loaded`);
    if (isComment) {
      this.loadedRepliesFor.add(targetId);
    } else {
      this.loadedCommentsFor.add(targetId);
    }
  });

  private updateCommentCollection(
    collection: typeof this.commentsMap | typeof this.repliesMap,
    parentId: string,
    newComments: CommentType[],
    clearExisting: boolean
  ): void {
    // Создаем observable объекты для каждого комментария
    const processedComments = newComments.map(comment => observable({
      ...comment,
      userName: comment.userName || comment.user?.userName || '',
    }));

    if (!collection.has(parentId)) {
      collection.set(parentId, observable([])); // Создаём observable массив
    }

    const existingComments = collection.get(parentId)!;

    if (clearExisting) {
      existingComments.splice(0, existingComments.length, ...processedComments); // Заменяем содержимое массива
    } else {
      const existingIds = new Set(existingComments.map(c => c.id));
      for (const comment of processedComments) {
        if (!existingIds.has(comment.id)) {
          existingComments.push(comment); // Добавляем новые комментарии
        }
      }
    }
  }
  // 3. applySorting не меняем

  // 4. sortedCommentsMap и sortedRepliesMap просто возвращают Map (без пересоздания массивов)
  get sortedCommentsMap(): Map<string, CommentType[]> {
    return this.commentsMap;
  }
  get sortedRepliesMap(): Map<string, CommentType[]> {
    return this.repliesMap;
  }

  public findCommentById(commentId: string): CommentType | null {
    // Ищем в commentsMap
    for (const [, comments] of this.commentsMap.entries()) {
      const comment = comments.find(c => c.id === commentId);
      if (comment) return comment;
    }

    // Ищем в repliesMap  
    for (const [, replies] of this.repliesMap.entries()) {
      const reply = replies.find(r => r.id === commentId);
      if (reply) return reply;
    }

    // Проверяем currentComment
    const current = this.currentComment.get();
    return current?.id === commentId ? current : null;
  }

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
    limit: number = 20,
    page: number = 1,
    sort?: 'date' | 'likes',
    isComment: boolean = false
  ): Promise<void> => {

    const requestKey = `${parentId}-${page}-${sort || this.sort}`;
    if (this.activeRepliesRequests.get(requestKey)) {
      logger.log(`[CommentStore] Request for ${requestKey} already active, skipping duplicate`);
      return Promise.resolve();
    }

    this.activeRepliesRequests.set(requestKey, true);
    this.setLoadingReplies(parentId, true);

    logger.log(`[CommentStore] loadComments ${isComment ? 'comment' : 'post'} ${parentId}, page ${page}, limit ${limit}`);

    const cacheKey = `${parentId}-${page}-${limit}-${sort || this.sort}-${isComment}`;
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
            logger.error(`[CommentStore] Error fetching comments:`, response.error);
            reject(new Error(response.error));
            return;
          }

          const comments = response?.comments || [];
          const totalCount = response?.total || 0;

          logger.log(`[CommentStore] Get ${comments.length} for parentId ${parentId}, total: ${totalCount}`);

          runInAction(() => {
            logger.log(`[CommentStore] Using ${isComment ? 'repliesMap' : 'commentsMap'} for parentId: ${parentId}`);

            this.updateCommentCollection(
              isComment ? this.repliesMap : this.commentsMap,
              parentId,
              comments,
              page === 1
            );

            this.totalItemsMap.set(parentId, totalCount);

            if (isComment) {
              this.loadedRepliesFor.add(parentId);
              const updatedReplies = this.repliesMap.get(parentId) || [];
              logger.log(`[CommentStore] Updated repliesMap for ${parentId}, count: ${updatedReplies.length}`);
            } else {
              this.loadedCommentsFor.add(parentId);
            }
          });
          if (isComment) {
            this.repliesMap.set(parentId, observable([...this.repliesMap.get(parentId)!]));
          }
          this.loadCommentsPromises.delete(cacheKey);
          resolve();
        });
    }).finally(() => {
      this.activeRepliesRequests.set(requestKey, false);
    });

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


  /**
   * Загружает следующую страницу комментариев
   */
  loadMoreComments = (parentId: string, limit: number = 20): Promise<void> => {
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
      this.loadComments(itemId, 20, 1, undefined, true);
    }
  };

  /**
   * Обработчик нового комментария
   */

  handleNewComment = action((comment: CommentType) => {
    if (!comment || !comment.id || !comment.content || !comment.createdAt) {
      logger.error("[CommentStore] Received invalid comment:", comment);
      return;
    }

    if (!comment.user && comment.userId) {
      const cachedUser = this.userStore.getCachedUser(comment.userId);
      if (cachedUser) {
        comment.user = cachedUser;
      } else {
        logger.warn(`[CommentStore] User not found in cache for userId: ${comment.userId}`);
        comment.user = {
          id: comment.userId,
          userName: "Unknown User",
          email: "",
          avatarUrl: null,
          avatarShape: "circle",
          role: "user",
          slug: "unknown-user",
        } as User;
      }
    }

    // runInAction чтобы обновить состояние MobX атомарно
    runInAction(() => {
      // Проверяем parentId для определения места добавления
      if (comment.parentId) { // Это ответ на комментарий - добавляем в repliesMap
        if (!this.repliesMap.has(comment.parentId)) {
          this.repliesMap.set(comment.parentId, observable([]));
        }

        const replies = this.repliesMap.get(comment.parentId)!;
        const existingIndex = replies.findIndex(c => c.id === comment.id);

        if (existingIndex >= 0) {
          replies[existingIndex] = comment;
          logger.log(`[CommentStore] Updated existing reply ${comment.id} in parent ${comment.parentId}`);
        } else {
          replies.unshift(comment); // Добавляем в начало
          logger.log(`[CommentStore] Added new reply ${comment.id} to parent ${comment.parentId}`);

          // Обновляем счетчик ответов
          const currentTotal = this.totalItemsMap.get(comment.parentId) || 0;
          this.totalItemsMap.set(comment.parentId, currentTotal + 1);
        }

        // Принудительно обновляем observable массив
        this.repliesMap.set(comment.parentId, observable([...replies]));

        // Уведомляем слушателей ответов
        this.notifyNewComment(comment.parentId, comment);
      } else if (comment.postId) { // Это комментарий к посту - добавляем в commentsMap
        if (!this.commentsMap.has(comment.postId)) {
          this.commentsMap.set(comment.postId, observable([]));
        }

        const comments = this.commentsMap.get(comment.postId)!;
        const existingIndex = comments.findIndex(c => c.id === comment.id);

        if (existingIndex >= 0) {
          comments[existingIndex] = comment;
          logger.log(`[CommentStore] Updated existing comment ${comment.id}`);
        } else {
          comments.unshift(comment); // Добавляем в начало
          logger.log(`[CommentStore] Added new comment ${comment.id} to top of list`);

          const currentTotal = this.totalItemsMap.get(comment.postId) || 0;
          this.totalItemsMap.set(comment.postId, currentTotal + 1);

          if (this.postStore) {
            this.postStore.updatePostCommentCount(comment.postId, currentTotal + 1);
          }
        }

        // Принудительно обновляем observable массив
        this.commentsMap.set(comment.postId, observable([...comments]));

        // Уведомляем слушателей комментариев к посту
        this.notifyNewComment(comment.postId, comment);
      } else {
        logger.error("[CommentStore] Cannot process comment without postId or parentId:", comment);
        return;
      }
    });

    logger.log(`[CommentStore] Successfully processed new comment: ${comment.id}`);
  });

  public onNewComment(postId: string, callback: (comment: CommentType) => void): void {
    this.newCommentListeners.set(postId, callback);
  }

  /**
   * Отписывается от событий новых комментариев
   */
  public offNewComment(postId: string): void {
    this.newCommentListeners.delete(postId);
    logger.log(`[CommentStore] Removed new comment listener for post ${postId}`);
  }

  /**
   * Уведомляет подписчиков о новом комментарии/ответе
   */
  private notifyNewComment(targetId: string, comment: CommentType): void {
    const listener = this.newCommentListeners.get(targetId);
    if (listener) {
      listener(comment);
      logger.log(`[CommentStore] Notified listener for ${targetId} about new comment ${comment.id}`);
    } else {
      const isReply = comment.parentId === targetId;
      if (!isReply) {
        logger.warn(`[CommentStore] No listener found for post ${targetId} to notify about new comment ${comment.id}`);
      }
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
   * Переключает лайк на комментарии с правильным обновлением observable
   */
  toggleLike = action((commentId: string, userId: string) => {
    const comment = this.getItemById(commentId);
    if (!comment) return;

    const isLiked = this.isItemLikedByUser(comment, userId);
    const newLikes = isLiked ? Math.max(0, (comment.likes || 0) - 1) : (comment.likes || 0) + 1;
    const newLikedUserIds = isLiked
      ? comment.likedUserIds?.filter(id => id !== userId) || []
      : [...(comment.likedUserIds || []), userId];

    runInAction(() => {
      let commentUpdated = false;

      // 1. Обновляем в commentsMap
      this.commentsMap.forEach((comments) => {
        const foundComment = comments.find(c => c.id === commentId);
        if (foundComment) {
          foundComment.likes = newLikes;
          foundComment.likedUserIds = newLikedUserIds;

          logger.log(`[CommentStore] Updated comment ${commentId} likes to ${newLikes} in commentsMap`);
          commentUpdated = true;
        }
      });

      // 2. Обновляем в repliesMap
      this.repliesMap.forEach((replies) => {
        const foundReply = replies.find(r => r.id === commentId);
        if (foundReply) {
          foundReply.likes = newLikes;
          foundReply.likedUserIds = newLikedUserIds;

          logger.log(`[CommentStore] Updated reply ${commentId} likes to ${newLikes} in repliesMap`);
          commentUpdated = true;
        }
      });

      // 3. Обновляем currentComment если есть
      const current = this.currentComment.get();
      if (current && current.id === commentId) {
        // Прямо изменяем observable объект
        current.likes = newLikes;
        current.likedUserIds = newLikedUserIds;
        logger.log(`[CommentStore] Updated currentComment ${commentId} likes to ${newLikes}`);
        commentUpdated = true;
      }

      if (commentUpdated) {
        logger.log(`[CommentStore] Comment ${commentId} ${isLiked ? 'unliked' : 'liked'}, new count: ${newLikes}`);
      } else {
        logger.warn(`[CommentStore] Comment ${commentId} not found in any collection for like update`);
      }
    });

    // Отправляем событие на сервер
    if (!this.socketStore.comments) {
      logger.log("[CommentStore] Cannot emit like event: socket not available");
      return;
    }

    const event = isLiked ? "unlikeComment" : "likeComment";
    this.socketStore.comments.emit(event, { commentId });
  });

  /**
   * Обрабатывает события лайка и анлайка от сервера для синхронизации
   */
  handleLikeEvent = action((data: {
    commentId: string;
    userId: string;
    newLikeCount: number;
    likedUserIds: string[];
    type: 'like' | 'unlike';
  }) => {
    const { commentId, newLikeCount, likedUserIds, type } = data;

    logger.log(`[CommentStore] Comment ${commentId} ${type === 'like' ? 'liked' : 'unliked'} by server, new count: ${newLikeCount}`);

    runInAction(() => {
      let commentUpdated = false;

      // 1. Обновляем в commentsMap
      this.commentsMap.forEach((comments) => {
        const foundComment = comments.find(c => c.id === commentId);
        if (foundComment) {
          // Прямо изменяем observable объект
          foundComment.likes = newLikeCount;
          foundComment.likedUserIds = likedUserIds;

          logger.log(`[CommentStore] Server updated comment ${commentId} likes to ${newLikeCount} in commentsMap`);
          commentUpdated = true;
        }
      });

      // 2. Обновляем в repliesMap
      this.repliesMap.forEach((replies) => {
        const foundReply = replies.find(r => r.id === commentId);
        if (foundReply) {
          // Прямо изменяем observable объект
          foundReply.likes = newLikeCount;
          foundReply.likedUserIds = likedUserIds;

          logger.log(`[CommentStore] Server updated reply ${commentId} likes to ${newLikeCount} in repliesMap`);
          commentUpdated = true;
        }
      });

      // 3. Обновляем currentComment если есть
      const current = this.currentComment.get();
      if (current && current.id === commentId) {
        // Прямо изменяем observable объект
        current.likes = newLikeCount;
        current.likedUserIds = likedUserIds;
        logger.log(`[CommentStore] Server updated currentComment ${commentId} likes to ${newLikeCount}`);
        commentUpdated = true;
      }

      if (!commentUpdated) {
        logger.warn(`[CommentStore] Comment ${commentId} not found when updating like state from server`);
      }
    });
  });

  /**
     Обновляет комментарий во всех коллекциях
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


  /**
   * Возвращает ответы на комментарий (теперь использует computed)
   */
  public getReplies(commentId: string): CommentType[] {
    const replies = this.repliesMap.get(commentId) || [];
    logger.log(`[CommentStore] getReplies(${commentId}):`, replies);
    return replies;
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
  getTotalComments = (postId: string): number => {
    // Возвращаем общее количество из totalItemsMap вместо длины массива комментариев
    const total = this.totalItemsMap.get(postId) || 0;
    logger.log(`[CommentStore]: getTotalComments(${postId}) = ${total}`);
    return total;
  };

  /**
   * Возвращает комментарии к посту
   */
  /**
   * Возвращает комментарии к посту (теперь использует computed)
   */
  public getComments(postId: string): CommentType[] {
    return this.commentsMap.get(postId) || [];
  }

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
   * Получает комментарий по slug
   */
  fetchCommentBySlug = action(async (slug: string): Promise<CommentType | null> => {
    logger.log(`[CommentStore] Fetching comment by slug: ${slug}`);

    // Проверяем, есть ли комментарий в кэше
    const cachedComment = this.getCommentBySlug(slug, false);
    if (cachedComment) {
      logger.log(`[CommentStore] Comment with slug ${slug} found in cache`);

      // Сохраняем найденный комментарий как текущий
      runInAction(() => {
        this.currentComment.set(cachedComment);
      });

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

              runInAction(() => {
                // Сохраняем комментарий как текущий
                this.currentComment.set(comment);

                if (comment.postId) {
                  // Это комментарий к посту - добавляем в commentsMap
                  const existingComments = this.commentsMap.get(comment.postId) || [];
                  const existingIndex = existingComments.findIndex(c => c.id === comment.id);

                  if (existingIndex >= 0) {
                    existingComments[existingIndex] = comment;
                  } else {
                    existingComments.push(comment);
                  }

                  this.commentsMap.set(comment.postId, observable([...existingComments]));
                  logger.log(`[CommentStore] Added/updated comment in post ${comment.postId} commentsMap`);
                } else if (comment.parentId) {
                  // Это ответ на комментарий - добавляем в repliesMap
                  const existingReplies = this.repliesMap.get(comment.parentId) || [];
                  const existingIndex = existingReplies.findIndex(r => r.id === comment.id);

                  if (existingIndex >= 0) {
                    existingReplies[existingIndex] = comment;
                  } else {
                    existingReplies.push(comment);
                  }

                  this.repliesMap.set(comment.parentId, observable([...existingReplies]));
                  logger.log(`[CommentStore] Added/updated reply in comment ${comment.parentId} repliesMap`);
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

    // Проверяем, является ли ответ объектом с ожидаемыми полями
    if (typeof response === 'object' && response !== null) {
      const maybeResponse = response as Partial<FetchCommentBySlugResponse>;

      if (maybeResponse.comment) { // Если есть поле comment, возвращаем его
        return maybeResponse.comment;
      }

      if (maybeResponse.comments && maybeResponse.comments.length > 0) { // Если есть поле comments, возвращаем первый комментарий
        return maybeResponse.comments[0];
      }
    }

    // Проверка на массив комментариев
    if (Array.isArray(response) && response.length > 0) {
      return response[0] as CommentType;
    }

    return null;
  }

  /**
   * Получает комментарии для поста по его slug
   */
  loadCommentsBySlug = action(async (entitySlug: string, limit: number = 20, page: number = 1,
    sort?: 'date' | 'likes', isComment?: boolean): Promise<void> => {
    logger.log(`[CommentStore] Loading comments by slug: ${entitySlug}, isComment: ${isComment}`);

    return this.fetchCommentsBySlug(entitySlug, limit, page, sort, isComment ?? false);
  });

  /**
   * Метод для прямого запроса комментариев по slug
   */
  private async fetchCommentsBySlug(slug: string, limit: number = 20, page: number = 1,
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

  fetchComments = async (postId: string, page: number = 1): Promise<void> => {
    logger.log(`[CommentStore] fetchComments for post ${postId}, page ${page}`);

    return this.loadComments(postId, 20, page, this.sort, false);
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
    return Math.ceil(comments.length / 20); // Используем стандартный размер страницы
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