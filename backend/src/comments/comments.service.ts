import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { CommentResponseDto } from './dto/comment-response.dto';
import { slugify } from '../utils/slugify';
import { User } from '../users/entities/user.entity';
import { SearchService } from '../search/search.service';
import type {
  CommentIndexInput,
  AuthorIndexInput,
  PostContextInput,
} from '../search/types/search-result.types';

@Injectable()
export class CommentsService {
  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Универсальный метод получения комментариев по ID родителя
   * Работает как для постов, так и для комментариев
   */
  async findCommentsByParentId(
    parentId: string,
    page: number,
    limit: number,
    sort: 'date' | 'likes' = 'date',
  ): Promise<{ comments: CommentResponseDto[]; total: number }> {
    try {
      // Проверяем, является ли parentId ID поста или комментария
      const isPostId =
        (await this.postRepository.findOne({
          where: { id: parentId },
        })) !== null;

      // Определение порядка сортировки
      const orderBy = sort === 'likes' ? 'entity.likes' : 'entity.createdAt';

      // Создаем queryBuilder для гибкого запроса
      const queryBuilder = this.commentRepository
        .createQueryBuilder('entity')
        .leftJoinAndSelect('entity.user', 'user')
        .select([
          'entity',
          'user.id',
          'user.userName',
          'user.avatarUrl',
          'user.avatarShape',
          'user.slug',
          'user.email',
          'user.role',
        ]);

      if (isPostId) {
        // Для поста выбираем комментарии верхнего уровня
        queryBuilder
          .where('entity.postId = :parentId', { parentId })
          .andWhere('entity.parentId IS NULL');
      } else {
        // Для комментария выбираем ответы
        queryBuilder.where('entity.parentId = :parentId', { parentId });
      }

      queryBuilder.orderBy(orderBy, 'DESC');

      // Если сортировка по лайкам, добавляем вторичную сортировку по дате
      if (sort === 'likes') {
        queryBuilder.addOrderBy('entity.createdAt', 'DESC');
      }

      queryBuilder.skip((page - 1) * limit).take(limit);

      // Получаем результаты и общее количество
      const [comments, total] = await queryBuilder.getManyAndCount();

      // Добавляем repliesCount для каждого комментария и трансформируем результат
      const transformedComments = await Promise.all(
        comments.map(async (comment) => {
          const repliesCount = await this.commentRepository.count({
            where: { parentId: comment.id },
          });

          const response = new CommentResponseDto();
          Object.assign(response, comment);
          response.userName = comment.user?.userName || 'Unknown';
          response.repliesCount = repliesCount;
          response.user = {
            id: comment.user?.id,
            userName: comment.user?.userName,
            avatarUrl: comment.user?.avatarUrl,
            avatarShape: comment.user?.avatarShape,
            slug: comment.user?.slug,
            email: comment.user?.email,
            role: comment.user?.role,
          };

          return response;
        }),
      );

      console.log(
        `Found ${transformedComments.length} comments/replies for parent ${parentId} out of ${total} total`,
      );
      return { comments: transformedComments, total };
    } catch (error) {
      console.error(`Error getting comments for parent ${parentId}:`, error);
      throw error;
    }
  }

  /**
   * Создание комментария через очередь RabbitMQ
   */
  async createComment(createCommentDto: CreateCommentDto): Promise<void> {
    await this.sendCommentToQueue(createCommentDto);
  }

  /**
   * Отправка комментария в очередь RabbitMQ
   */
  private async sendCommentToQueue(
    createCommentDto: CreateCommentDto,
  ): Promise<void> {
    const queueName = 'add_comment_queue';
    await this.rabbitMQService.sendToQueue(queueName, {
      createCommentDto: createCommentDto,
    });
    console.log(`Comment sent to queue "${queueName}":`, createCommentDto);
  }

  async saveCommentFromQueue(
    createCommentDto: CreateCommentDto,
  ): Promise<Comment> {
    // Проверка обязательных полей
    if (!createCommentDto.userId || !createCommentDto.postId) {
      throw new Error('userId and postId are required for comment creation');
    }

    // Обработка parentId
    let parentUuid: string | null = null;
    if (createCommentDto.parentId) {
      // Если числовой ID, находим соответствующий комментарий
      if (/^\d+$/.test(createCommentDto.parentId)) {
        const parent = await this.commentRepository.findOne({
          where: { numericId: createCommentDto.parentId },
        });
        if (parent) parentUuid = parent.id;
      } else {
        parentUuid = createCommentDto.parentId;
      }
    }

    // Создаем комментарий
    const commentData: Partial<Comment> = {
      content: createCommentDto.content,
      userId: createCommentDto.userId,
      postId: createCommentDto.postId,
      parentId: parentUuid,
      fileUrl: createCommentDto.fileUrl || null,
      fileName: createCommentDto.fileName || null,
      fileType: createCommentDto.fileType || null,
      imageUrl:
        createCommentDto.imageUrl ||
        (createCommentDto.fileUrl &&
        createCommentDto.fileType?.startsWith('image/')
          ? createCommentDto.fileUrl
          : null),
      likes: 0,
      likedUserIds: [],
      repliesCount: 0,
    };

    const comment = this.commentRepository.create({
      ...commentData,
      slug: slugify(createCommentDto.content.slice(0, 50)) + '-' + Date.now(),
    });

    // Генерируем числовой ID
    const base = Date.now().toString();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    comment.numericId = base + random;

    // Сохраняем комментарий
    const savedComment = await this.commentRepository.save(comment);

    try {
      const [user, post] = await Promise.all([
        this.userRepository.findOne({
          where: { id: createCommentDto.userId },
          select: [
            'id',
            'userName',
            'avatarUrl',
            'avatarShape',
            'slug',
            'email',
            'role',
          ],
        }),
        this.postRepository.findOne({
          where: { id: createCommentDto.postId },
          select: ['id', 'slug', 'content'],
        }),
      ]);

      if (user) {
        const commentIndexData: CommentIndexInput = {
          id: savedComment.id,
          content: savedComment.content,
          slug: savedComment.slug,
          likes: savedComment.likes || 0,
          repliesCount: savedComment.repliesCount || 0,
          imageUrl: savedComment.imageUrl ?? undefined,
          fileUrl: savedComment.fileUrl ?? undefined,
          fileName: savedComment.fileName ?? undefined,
          fileType: savedComment.fileType ?? undefined,
          userId: savedComment.userId,
          postId: savedComment.postId,
          parentId: savedComment.parentId ?? undefined,
          createdAt: savedComment.createdAt,
          updatedAt: savedComment.updatedAt,
        };

        const authorIndexData: AuthorIndexInput = {
          id: user.id,
          userName: user.userName,
          avatarUrl: user.avatarUrl,
          avatarShape: user.avatarShape,
          slug: user.slug,
          email: user.email,
          role: user.role,
        };

        const postContextData: PostContextInput | undefined = post
          ? {
              id: post.id,
              slug: post.slug,
              content: post.content,
            }
          : undefined;

        await this.searchService.indexComment(
          commentIndexData,
          authorIndexData,
          postContextData,
        );
        console.log(`✅ Comment ${savedComment.id} indexed in Elasticsearch`);
      }
    } catch (error) {
      console.error(`❌ Failed to index comment ${savedComment.id}:`, error);
    }

    // ВАША ЛОГИКА: Увеличиваем счетчик комментариев в посте
    if (!savedComment.parentId) {
      // Только для комментариев верхнего уровня обновляем счетчик в посте
      const commentCount = await this.commentRepository.count({
        where: {
          postId: createCommentDto.postId,
          parentId: undefined, // Только комментарии верхнего уровня
        },
      });

      await this.postRepository.update(
        { id: createCommentDto.postId },
        { repliesCount: commentCount },
      );

      console.log(
        `Updated post ${createCommentDto.postId} comment count to ${commentCount}`,
      );
    } else {
      // Для вложенных комментариев обновляем счетчик у родительского комментария
      const repliesCount = await this.commentRepository.count({
        where: { parentId: savedComment.parentId },
      });

      await this.commentRepository.update(
        { id: savedComment.parentId },
        { repliesCount: repliesCount },
      );

      console.log(
        `Updated comment ${savedComment.parentId} replies count to ${repliesCount}`,
      );
    }

    // Отправляем уведомление всем клиентам
    if (this.server) {
      this.server.emit('newComment', {
        postId: savedComment.postId,
        comment: savedComment,
      });
    }

    return savedComment;
  }
  async deleteComment(commentId: string): Promise<boolean> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      return false;
    }

    // Удаляем из Elasticsearch
    try {
      await this.searchService.deleteComment(commentId);
      console.log(`✅ Comment ${commentId} deleted from Elasticsearch`);
    } catch (error) {
      console.error(
        `❌ Failed to delete comment ${commentId} from Elasticsearch:`,
        error,
      );
    }

    // Удаляем комментарий
    await this.commentRepository.delete(commentId);

    // ВАША ЛОГИКА: Правильно обновляем счетчики после удаления
    if (!comment.parentId) {
      // Если это комментарий к посту
      const commentCount = await this.commentRepository.count({
        where: {
          postId: comment.postId,
          parentId: undefined,
        },
      });

      await this.postRepository.update(
        { id: comment.postId },
        { repliesCount: commentCount },
      );
    } else {
      // Если это ответ на комментарий
      const repliesCount = await this.commentRepository.count({
        where: { parentId: comment.parentId },
      });

      await this.commentRepository.update(
        { id: comment.parentId },
        { repliesCount: repliesCount },
      );
    }

    return true;
  }
  /**
   * Получение комментария по ID
   */
  async getCommentById(id: string): Promise<Comment | undefined> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ['user'],
      select: {
        user: {
          id: true,
          userName: true,
          email: true,
          avatarUrl: true,
          avatarShape: true,
        },
      },
    });

    return comment || undefined;
  }

  /**
   * Лайк комментария
   */
  async likeComment(commentId: string, userId: string) {
    try {
      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
      });

      if (!comment) {
        return { success: false, message: 'Comment not found' };
      }

      const likedUserIds = comment.likedUserIds || [];

      if (likedUserIds.includes(userId)) {
        return { success: false, message: 'Comment already liked' };
      }

      const updatedLikedUserIds = [...likedUserIds, userId];

      await this.commentRepository.update(commentId, {
        likedUserIds: updatedLikedUserIds,
        likes: updatedLikedUserIds.length,
      });

      return {
        success: true,
        likeCount: updatedLikedUserIds.length,
        likedUserIds: updatedLikedUserIds,
      };
    } catch (error) {
      console.error('Error liking comment:', error);
      return { success: false, message: 'Database error' };
    }
  }

  /**
   * Отмена лайка комментария
   */
  async unlikeComment(commentId: string, userId: string) {
    try {
      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
      });

      if (!comment) {
        return { success: false, message: 'Comment not found' };
      }

      const likedUserIds = comment.likedUserIds || [];

      if (!likedUserIds.includes(userId)) {
        return { success: false, message: 'Comment not liked' };
      }

      const updatedLikedUserIds = likedUserIds.filter((id) => id !== userId);

      await this.commentRepository.update(commentId, {
        likedUserIds: updatedLikedUserIds,
        likes: updatedLikedUserIds.length,
      });

      return {
        success: true,
        likeCount: updatedLikedUserIds.length,
        likedUserIds: updatedLikedUserIds,
      };
    } catch (error) {
      console.error('Error unliking comment:', error);
      return { success: false, message: 'Database error' };
    }
  }

  /**
   * Поиск комментария по слагу
   */
  async findCommentBySlug(slug: string): Promise<Comment | null> {
    return this.commentRepository.findOne({
      where: { slug },
      relations: ['user'],
    });
  }
}
