import { Post, Comment, User } from "../../types/interfaces";

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  page?: number;
}

export interface BaseSocketResponse {
  success?: boolean;
  error?: string;
  message?: string;
  total?: number;
  page?: number;
}

export interface PostSocketResponse extends BaseSocketResponse {
  posts?: Post[];
  post?: Post;
  data?: Post | Post[];
  allLoaded?: boolean;
}

export interface CommentSocketResponse extends BaseSocketResponse {
  comments?: Comment[];
  comment?: Comment;
  data?: Comment | Comment[];
  allLoaded?: boolean;
}

export interface UserSocketResponse extends BaseSocketResponse {
  user?: User;
  data?: User;
  token?: string;
}

// Общий тип для socket ответов
export type SocketResponse = PostSocketResponse | CommentSocketResponse | UserSocketResponse | (BaseSocketResponse & {
  data?: unknown;
  [key: string]: unknown;
});