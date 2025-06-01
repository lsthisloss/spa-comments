export interface User {
  id: string;
  userName: string;
  email: string;
  token?: string;
  following?: User[];
  followers?: User[];
  avatarUrl?: string | null;
  avatarShape?: 'circle' | 'square';
  settings?: {
    debugMode?: boolean;
    notifications?: boolean;
  }
  slug?: string;
  createdAt?: string; 
  updatedAt?: string;
}

// Базовый интерфейс только с общими свойствами
export interface FeedItemBase {
  id: string;
  userName: string;
  createdAt: string;
  content: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  likes?: number;
  children?: FeedItemBase[];
  level?: number;
  user?: Partial<User>;
  likedUserIds?: string[];
  userId: string;
  fileType?: string;
  slug: string;
  avatarUrl?: string | null;
  avatarShape?: string;
  updatedAt?: string;
}

// Интерфейс поста
export interface Post extends FeedItemBase {
  commentCount?: number;
  imageHeight?: number;
}

// Интерфейс комментария
export interface Comment extends FeedItemBase {
  parentId?: string;
  postId: string; 
  postSlug?: string; 
  imageHeight?: number;
  repliesShown?: boolean; 
  numericId?: string; 
  repliesCount?: number;
}

// UI-свойства
export interface FeedItemUIProps {
  hideCommentButton?: boolean;
  disableShowMore?: boolean;
}

//прочие интерфейсы
export interface BaseData {
   image: { name: string; type: string; base64: string; };
   userId: string;
   content: string;
   userName: string;
   parentId?: string | null;
   postId?: string | null;
   file?: {
     name: string;
     type: string;
     base64: string;
   };
   
 }

export interface UpdateUserData {
  userName?: string;
  email?: string;
  password?: string;
}


export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}


export interface RegisterFormValues {
  email: string;
  userName: string;
  password: string;
}

export interface RegisterResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

export interface NavigationState {
  scrollPosition: number;
  fromFeed?: boolean;
  fromFollowing?: boolean;
  fromUserProfile?: boolean;
  userId?: string;
  fromPost?: boolean;
  postId?: string;
  fromComment?: boolean;
  commentId?: string;
  returnedFromComment?: boolean;
  previousState?: NavigationState;
}


export interface SendFormProps {
  type: 'post' | 'comment';
  parentId?: string;
  parentSlug?: string;
  postId?: string;
  postSlug?: string;
  placeholder?: string;
  onSuccess?: () => void;
}

export interface FetchCommentsResponse {
  comments?: Comment[];
  total?: number;
  error?: string;
}
export  interface FetchCommentBySlugResponse {
    comment?: Comment;
    comments?: Comment[];
    error?: string;
  }
  