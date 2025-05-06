import { IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty()
  userName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  text: string;

  @IsOptional()
  homePage?: string;

  @IsOptional()
  parentId?: string | null;

  @IsOptional()
  imageUrl?: string;

  @IsOptional()
  file?: {
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
  likes?: number;
}
