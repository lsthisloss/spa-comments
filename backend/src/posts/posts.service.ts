import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { User } from '../users/entities/user.entity';
import { Comment } from '../comments/entities/comment.entity';
import { PostResponseDto } from './dto/post-response.dto';
import { UserBasicDto } from '../users/dto/user-basic.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async sendPostToQueue(createPostDto: CreatePostDto): Promise<void> {
    const queueName = 'add_post_queue';
    await this.rabbitMQService.sendToQueue(queueName, {
      createPostDto: createPostDto,
    });
    console.log(`Post sent to queue "${queueName}":`, createPostDto);
  }

  async createPost(createPostDto: CreatePostDto): Promise<Post> {
    const post = this.postRepository.create({
      ...createPostDto,
      likes: 0,
      repliesCount: 0,
      likedUserIds: [],
    });
    await this.postRepository.save(post);
    return post;
  }

  async getPostById(id: string): Promise<PostResponseDto | undefined> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['user'],
      select: {
        user: {
          id: true,
          userName: true,
          avatarUrl: true,
          avatarShape: true,
        },
      },
    });

    if (!post) return undefined;

    const response = new PostResponseDto();
    Object.assign(response, post);
    response.userName = post.user?.userName || 'Unknown';
    response.user = {
      id: post.user?.id,
      userName: post.user?.userName,
      avatarUrl: post.user?.avatarUrl,
      avatarShape: post.user?.avatarShape,
    };

    return response;
  }

  async enrichPostsWithUserData(posts: Post[]): Promise<PostResponseDto[]> {
    const userIds = [...new Set(posts.map((post) => post.userId))];
    const users = await this.userRepository.find({
      where: { id: In(userIds) },
      select: ['id', 'userName', 'avatarUrl', 'avatarShape'],
    });

    const userMap = new Map<string, UserBasicDto>();
    users.forEach((user) =>
      userMap.set(user.id, {
        id: user.id,
        userName: user.userName,
        avatarUrl: user.avatarUrl,
        avatarShape: user.avatarShape,
      }),
    );

    return posts.map((post) => {
      const response = new PostResponseDto();
      Object.assign(response, post);
      response.userName = userMap.get(post.userId)?.userName || 'Unknown';
      response.user = userMap.get(post.userId);
      return response;
    });
  }

  async getAllPosts(): Promise<PostResponseDto[]> {
    const posts = await this.postRepository.find({
      order: { createdAt: 'DESC' },
    });

    return this.enrichPostsWithUserData(posts);
  }

  async getPostsPaginated(
    page: number,
    limit: number,
  ): Promise<{ posts: PostResponseDto[]; total: number }> {
    const [posts, total] = await this.postRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const enrichedPosts = await this.enrichPostsWithUserData(posts);
    return { posts: enrichedPosts, total };
  }

  async savePost(post: Post): Promise<Post> {
    return this.postRepository.save(post);
  }

  async likePost(
    postId: string,
    userId: string,
  ): Promise<{ success: boolean; likes: number }> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) return { success: false, likes: 0 };

    post.likedUserIds = post.likedUserIds || [];
    if (!post.likedUserIds.includes(userId)) {
      post.likedUserIds.push(userId);
      post.likes = post.likedUserIds.length;
      await this.savePost(post);
      return { success: true, likes: post.likes };
    }
    return { success: false, likes: post.likes };
  }

  async unlikePost(
    postId: string,
    userId: string,
  ): Promise<{ success: boolean; likes: number }> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) return { success: false, likes: 0 };

    post.likedUserIds = post.likedUserIds || [];
    if (post.likedUserIds.includes(userId)) {
      post.likedUserIds = post.likedUserIds.filter((id) => id !== userId);
      post.likes = post.likedUserIds.length;
      await this.savePost(post);
      return { success: true, likes: post.likes };
    }
    return { success: false, likes: post.likes };
  }

  async getUserPosts(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PostResponseDto[]> {
    try {
      const posts = await this.postRepository.find({
        where: { userId: userId },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Используем enrichPostsWithUserData для единообразия
      const enrichedPosts = await this.enrichPostsWithUserData(posts);

      console.log(`Found ${posts.length} posts for user ${userId}`);
      return enrichedPosts;
    } catch (error) {
      console.error(`Error getting posts for user ${userId}:`, error);
      throw error;
    }
  }

  async getUserPostsCount(userId: string): Promise<number> {
    try {
      const count = await this.postRepository.count({
        where: { userId: userId },
      });

      console.log(`Total posts for user ${userId}: ${count}`);
      return count;
    } catch (error) {
      console.error(`Error counting posts for user ${userId}:`, error);
      throw error;
    }
  }

  async getFollowingPostsCount(userId: string): Promise<number> {
    try {
      // Получаем пользователей, на которых подписан + добавляем самого себя
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['following'],
      });

      if (!user) {
        return 0;
      }

      // Создаем список ID: подписки + сам пользователь
      const followingIds = user.following
        ? user.following.map((followedUser) => followedUser.id)
        : [];
      const userIdsToQuery = [...followingIds, userId]; // Добавляем самого себя

      if (userIdsToQuery.length === 0) {
        return 0;
      }

      const count = await this.postRepository.count({
        where: {
          userId: In(userIdsToQuery),
        },
      });

      console.log(`Total following posts for user ${userId}: ${count}`);
      return count;
    } catch (error) {
      console.error('Error getting following posts count:', error);
      return 0;
    }
  }

  async getFeedPosts(
    page: number,
    limit: number,
  ): Promise<{ posts: PostResponseDto[]; total: number }> {
    return this.getPostsPaginated(page, limit);
  }

  async getFollowingPosts(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ posts: PostResponseDto[]; total: number }> {
    console.log(`Getting following posts for user ${userId}, page ${page}`);

    try {
      // Получаем пользователей, на которых подписан + добавляем самого себя
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['following'],
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Создаем список ID: подписки + сам пользователь
      const followingIds = user.following
        ? user.following.map((followedUser) => followedUser.id)
        : [];
      const userIdsToQuery = [...followingIds, userId]; // Добавляем самого себя

      console.log(
        `User ${userId} (${user.userName}) following:`,
        user.following?.map((f) => `${f.id} (${f.userName})`) || [],
      );
      console.log(`Following IDs for user ${userId}:`, followingIds);
      console.log(`All user IDs to query (including self):`, userIdsToQuery);

      if (userIdsToQuery.length === 0) {
        return { posts: [], total: 0 };
      }

      // Получаем посты от всех пользователей (включая себя)
      const [posts, total] = await this.postRepository.findAndCount({
        where: {
          userId: In(userIdsToQuery),
        },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Добавляем userName к каждому посту
      const enrichedPosts = await this.enrichPostsWithUserData(posts);

      console.log(
        `Found ${posts.length} following posts out of ${total} total`,
      );

      return { posts: enrichedPosts, total };
    } catch (error) {
      console.error('Error getting following posts:', error);
      throw error;
    }
  }

  /**
   * Обновить счетчик комментариев в посте
   */
  async updateCommentCount(postId: string): Promise<number> {
    try {
      // Only count top-level comments (explicitly check for null parentId)
      const commentCount = await this.commentRepository.count({
        where: {
          postId,
          parentId: IsNull(), // Only comments with null parentId (top-level comments)
        },
      });

      // Update the post with just the count of top-level comments
      await this.postRepository.update(
        { id: postId },
        { repliesCount: commentCount },
      );

      console.log(`Updated comment count for post ${postId}: ${commentCount}`);
      return commentCount;
    } catch (error) {
      console.error(`Error updating comment count for post ${postId}:`, error);
      return 0;
    }
  }
}
