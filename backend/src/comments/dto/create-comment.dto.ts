import { IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty()
  userName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  text: string;

  @IsOptional()
  parentId?: string | null;
}
