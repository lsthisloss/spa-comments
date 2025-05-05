import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AppGateway } from '../app.gateway';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly appGateway: AppGateway,
  ) {}

  async createComment(createCommentDto: CreateCommentDto): Promise<Comment> {
    const comment = this.commentRepository.create(createCommentDto);
    await this.commentRepository.save(comment);
    console.log('Saved comment:', comment);
    this.appGateway.broadcastEvent('newComment', comment);
    return comment;
  }
  async getAllComments(): Promise<Comment[]> {
    return this.commentRepository.find();
  }

  async getCommentById(id: string): Promise<Comment | undefined> {
    const comment = await this.commentRepository.findOne({ where: { id } });
    return comment ?? undefined;
  }

  async findAllWithPagination(
    page: number,
    limit: number,
  ): Promise<[Comment[], number]> {
    const [data, total] = await this.commentRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return [data, total];
  }

  async getCommentsByParentId(parentId: string): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { parentId },
      order: { createdAt: 'ASC' },
    });
  }
}
