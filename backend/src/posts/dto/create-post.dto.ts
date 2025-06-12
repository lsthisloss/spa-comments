import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePostDto {
  @IsNotEmpty()
  userId: string;

  @IsNotEmpty()
  content: string;

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
  fileUrl?: string;

  @IsOptional()
  fileName?: string;

  @IsOptional()
  fileType?: string;

  @IsOptional()
  imageUrl?: string;
}
