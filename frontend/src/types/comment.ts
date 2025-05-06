export interface Comment {
  id: string;
  userName: string;
  email: string;
  homePage?: string;
  text: string;
  createdAt: Date;
  parentId?: string | null;
  imageUrl?: string;
  likes?: number;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}

export interface UserInfo {
  userName?: string;
  email?: string;
  homePage?: string;
}