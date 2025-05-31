import { UserBasicDto } from '../../users/dto/user-basic.dto';

export class PostResponseDto {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  likes?: number;
  likedUserIds?: string[];
  repliesCount?: number;
  user?: UserBasicDto;
  slug?: string;
}
