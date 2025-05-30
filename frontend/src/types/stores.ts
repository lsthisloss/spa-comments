// Файл для управления ссылками на store-объекты и предотвращения циклических зависимостей
import { User, Post, Comment } from "./interfaces";

export interface IAuthStore {
  token: string | null;
  userId: string | null;
  userName: string | null;
  isAuthenticated: boolean;
  initialLoadComplete: boolean;
  socketsInitializing: boolean;
  setAuth(token: string, userId: string, userName: string): Promise<void>;
  logout(): void;
  syncWithUserStore(user: { id: string; token: string; userName: string }): void;
  readonly isAuthReady: boolean;
}

export interface ISocketStore {
  users: ReturnType<typeof io> | null;
  posts: ReturnType<typeof io> | null;
  comments: ReturnType<typeof io> | null;
  connected: boolean;
  postsReady: boolean;
  commentsReady: boolean;
  isReconnecting: boolean;
  initializeAuthenticatedSockets(token: string): Promise<void>;
  disconnectAuthenticatedSockets(): void;
  disconnectAllSockets(): void;
  waitForPostsSocket(timeoutMs?: number): Promise<boolean>;
  waitForCommentsSocket(timeoutMs?: number): Promise<boolean>;
  isSocketReady(socket:  ReturnType<typeof io> | null): boolean;
  isPostsSocketReady(): boolean;
  isCommentsSocketReady(): boolean;
}

export interface IUserStore {
  user: User | null;
  isAuthenticated: boolean;
  usersCache: Map<string, User>;
  loadingUsers: Set<string>;
  setUser: (user: User | null) => void;
  logout: () => void;
  getUserById: (userId: string) => Promise<User | null>;
  isUserLoading: (userId: string) => boolean;
  getCachedUser: (userId: string) => User | null;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  isFollowing: (userId: string) => boolean;
  clearUsersCache: () => void;
  updateUser: (updateData: { userName?: string; email?: string; password?: string }) => Promise<User>;
  deleteUser: () => Promise<void>;
}

export interface IPostStore {
  feedList: Post[];
  feedLoading: boolean;
  feedAllLoaded: boolean;
  feedTotal: number;
  fetchFeedPosts(page?: number): Promise<void>;
  loadMoreFeedPosts(): void;
  resetFeedState(): void;
  hasFeedItems: boolean;
  hasFollowingItems: boolean;
  getPostById(postId: string): Post | undefined;
  toggleLike(postId: string, userId: string): void;
}

export interface ICommentStore {
  getComments(postId: string): Comment[];
  isLoading(postId: string): boolean;
  getTotalComments(postId: string): number;
  fetchComments(postId: string, page?: number): Promise<void>;
  getCommentById(commentId: string): Comment | undefined;
  hasLoaded(postId: string): boolean;
  getCurrentPage(postId: string): number;
  loadComments(postId: string, page?: number, limit?: number): Promise<void>;
  loadMoreComments(parentId: string, limit?: number): Promise<void>;
  sort: 'date' | 'likes';
  setSort(sort: 'date' | 'likes'): void;
  updateItemSize(itemId: string, height: number): void;
}

export let authStore: IAuthStore | null = null;
export let socketStore: ISocketStore | null = null;
export let userStore: IUserStore | null = null;
export let postStore: IPostStore | null = null;
export let commentStore: ICommentStore | null = null;

// Регистрации store-объектов 
export const registerAuthStore = (store: IAuthStore): void => {
  authStore = store;
};

export const registerSocketStore = (store: ISocketStore): void => {
  socketStore = store;
};

export const registerUserStore = (store: IUserStore): void => {
  userStore = store;
};

export const registerPostStore = (store: IPostStore): void => {
  postStore = store;
};

export const registerCommentStore = (store: ICommentStore): void => {
  commentStore = store;
};