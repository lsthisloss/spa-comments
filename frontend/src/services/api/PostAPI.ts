import { socketStore } from "../stores/SocketStore";
import { BaseAPI } from "./BaseAPI";
import { APIResponse } from "./types";
import { Post } from "../../types/interfaces";
import  io  from "socket.io-client";

// Получаем тип Socket из возвращаемого значения io()
type SocketType = ReturnType<typeof io>;

export interface FetchPostsParams {
  page?: number;
  limit?: number;
  userId?: string;
  sort?: 'date' | 'likes';
}

export interface PostsResponse {
  posts: Post[];
  total: number;
  page?: number;
  allLoaded?: boolean;
}

export class PostAPI extends BaseAPI {
  constructor() {
    super("Posts");
  }

  protected getSocket(): SocketType | null {
    return socketStore.posts;
  }

  async fetchFeed(params: FetchPostsParams = {}): Promise<APIResponse<PostsResponse>> {
    return this.request<PostsResponse>("fetchPosts", {
      page: 1,
      limit: 25,
      ...params
    });
  }

  async fetchFollowingPosts(params: FetchPostsParams = {}): Promise<APIResponse<PostsResponse>> {
    return this.request<PostsResponse>("fetchFollowingPosts", {
      page: 1,
      limit: 25,
      ...params
    });
  }

  async fetchUserPosts(userId: string, params: FetchPostsParams = {}): Promise<APIResponse<PostsResponse>> {
    return this.request<PostsResponse>("fetchUserPosts", {
      userId,
      page: 1,
      limit: 25,
      ...params
    });
  }

  async fetchPostBySlug(slug: string): Promise<APIResponse<Post>> {
    return this.request<Post>("fetchPostBySlug", { slug });
  }

  async createPost(content: string, image?: unknown, file?: unknown): Promise<APIResponse<Post>> {
    return this.request<Post>("addPost", {
      content,
      image,
      file
    });
  }

  async likePost(postId: string): Promise<APIResponse<unknown>> {
    return this.request("likePost", { postId });
  }

  async unlikePost(postId: string): Promise<APIResponse<unknown>> {
    return this.request("unlikePost", { postId });
  }

  async deletePost(postId: string): Promise<APIResponse<unknown>> {
    return this.request("deletePost", { postId });
  }
}

export const postAPI = new PostAPI();