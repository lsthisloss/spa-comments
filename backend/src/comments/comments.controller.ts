import { Body, Controller, Get, Post, Param, Query } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  async createComment(@Body() createCommentDto: CreateCommentDto) {
    return await this.commentsService.createComment(createCommentDto);
  }

  @Get()
  async getComments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 25,
  ) {
    const [data, total] = await this.commentsService.findAllWithPagination(
      page,
      limit,
    );
    return { data, total };
  }

  @Get(':id')
  async getCommentById(@Param('id') id: string) {
    return this.commentsService.getCommentById(id);
  }
}
