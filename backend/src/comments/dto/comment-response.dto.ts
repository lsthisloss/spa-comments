import { UserBasicDto } from '../../users/dto/user-basic.dto';

export class CommentResponseDto {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  postId: string;
  parentId?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  likes?: number;
  likedUserIds?: string[];
  repliesCount: number;
  user?: UserBasicDto;
  slug?: string;
}
