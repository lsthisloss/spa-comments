import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty()
  content: string;

  @IsNotEmpty()
  @IsUUID()
  postId: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  file?: {
    name: string;
    type: string;
    base64: string;
  };

  @IsOptional()
  image?: {
    name: string;
    type: string;
    base64: string;
  };

  @IsOptional()
  fileUrl?: string | null;

  @IsOptional()
  fileName?: string | null;

  @IsOptional()
  fileType?: string | null;

  @IsOptional()
  imageUrl?: string | null;
}
