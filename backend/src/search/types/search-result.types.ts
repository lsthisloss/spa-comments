export interface UserSearchResult {
  id: string;
  userName: string;
  email: string;
  avatarUrl?: string;
  avatarShape?: string;
  slug: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostSearchResult {
  id: string;
  content: string;
  slug: string;
  likes: number;
  repliesCount: number;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    userName: string;
    avatarUrl?: string;
    avatarShape?: string;
    slug: string;
    email: string;
    role: string;
  };
}

export interface CommentSearchResult {
  id: string;
  content: string;
  slug: string;
  likes: number;
  repliesCount: number;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  userId: string;
  postId: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    userName: string;
    avatarUrl?: string;
    avatarShape?: string;
    slug: string;
    email: string;
    role: string;
  };
  post?: {
    id: string;
    slug: string;
    content: string;
  };
}

export interface SearchResponse {
  users: Array<UserSearchResult & { _score?: number; type: 'user' }>;
  posts: Array<PostSearchResult & { _score?: number; type: 'post' }>;
  comments: Array<CommentSearchResult & { _score?: number; type: 'comment' }>;
}

// НОВЫЕ типы для входных данных
export interface PostIndexInput {
  id: string;
  content: string;
  slug: string;
  likes?: number;
  repliesCount?: number;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentIndexInput {
  id: string;
  content: string;
  slug: string;
  likes?: number;
  repliesCount?: number;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  userId: string;
  postId: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthorIndexInput {
  id: string;
  userName: string;
  avatarUrl?: string;
  avatarShape?: string;
  slug: string;
  email: string;
  role: string;
}

export interface PostContextInput {
  id: string;
  slug: string;
  content: string;
}
