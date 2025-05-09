import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AppGateway } from '../app.gateway';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly appGateway: AppGateway,
    private readonly rabbitMQService: RabbitMQService, // Внедрение RabbitMQService
  ) {}

  async sendCommentToQueue(createCommentDto: CreateCommentDto): Promise<void> {
    const queueName = 'add_comment_queue';
    await this.rabbitMQService.sendToQueue(queueName, {
      createCommentDto: createCommentDto,
    });
    console.log(`Comment sent to queue "${queueName}":`, createCommentDto);
  }

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

  async getCommentsByParentId(parentId: string, limit = 3): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { parentId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findTopLevelComments(
    page: number,
    limit: number,
  ): Promise<[Array<Comment & { repliesCount: number }>, number]> {
    const [data, total] = await this.commentRepository.findAndCount({
      where: { parentId: IsNull() },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    const dataWithRepliesCount = await Promise.all(
      data.map(async (comment) => {
        const repliesCount = await this.commentRepository.count({
          where: { parentId: comment.id },
        });
        return { ...comment, repliesCount };
      }),
    );
    return [dataWithRepliesCount, total];
  }

  async saveComment(comment: Comment): Promise<Comment> {
    return this.commentRepository.save(comment);
  }
}
