// Файл для типизации store-объектов
import { User, Post, Comment } from "./interfaces";
import type { Socket } from "socket.io-client";

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
  users: typeof Socket | null;
  posts: typeof Socket | null;
  comments: typeof Socket | null;
  search: typeof Socket | null;
  connected: boolean;
  postsReady: boolean;
  commentsReady: boolean;
  isReconnecting: boolean;
  initializeAuthenticatedSockets(token: string): Promise<void>;
  disconnectAuthenticatedSockets(): void;
  disconnectAllSockets(): void;
  waitForPostsSocket(timeoutMs?: number): Promise<boolean>;
  waitForCommentsSocket(timeoutMs?: number): Promise<boolean>;
  isSocketReady(socket: typeof Socket | null): boolean;
  isPostsSocketReady(): boolean;
  isCommentsSocketReady(): boolean;
  isSocketConnected(type: 'posts' | 'comments' | 'users' | 'search'): boolean;
  checkConnections(): void;
}

export interface IUserStore {
  user: User | null;
  isAuthenticated: boolean;
  loginLoading: boolean;
  
  login(email: string, password: string): Promise<{
    success: boolean;
    message?: string;
    user?: User;
  }>;
  
  register(email: string, userName: string, password: string): Promise<{
    success: boolean;
    message?: string;
    user?: User;
  }>;
  
  setUser(user: User | null): void;
  logout(): void;
  getUserById(userIdOrSlug: string): Promise<User | null>;
  
  // Геттеры для ролей
  readonly isAdmin: boolean;
  readonly isSuperAdmin: boolean;
  readonly canManageAdmins: boolean;
  readonly canExecuteDebugTests: boolean;
  usersCache: Map<string, User>;
  loadingUsers: Set<string>;
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
  fetchFollowingPosts(page?: number): Promise<void>;
  fetchUserPosts(userId: string, page?: number): Promise<void>;
  loadMoreFeedPosts(): void;
  resetFeedsState(): void;
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
  toggleLike(commentId: string, userId: string): void;
}