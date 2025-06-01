import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { slugify } from '../utils/slugify';
import { isUUID } from 'class-validator';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async getUserById(userId: string): Promise<User | null> {
    try {
      this.logger.log(`Getting user by ID: ${userId}`);

      // Сначала проверим что есть в junction table
      const followingCheck = await this.checkFollowingRelations(userId);
      this.logger.log(
        `User ${userId} has ${followingCheck.following.length} following relations and ${followingCheck.followers.length} followers in DB`,
      );
      // Затем загружаем пользователя с отношениями
      const user = await this.userRepository
        .createQueryBuilder('user')
        .where('user.id = :userId', { userId })
        .leftJoinAndSelect('user.following', 'following')
        .leftJoinAndSelect('user.followers', 'followers')
        .getOne();

      if (!user) {
        this.logger.warn(`User not found: ${userId}`);
        return null;
      }

      this.logger.log(
        `User ${userId} loaded with ${user.following?.length || 0} following and ${user.followers?.length || 0} followers. DB shows ${followingCheck.following.length} following relations.`,
      );

      // Если есть несоответствие между DB и загруженными данными
      if (followingCheck.following.length !== (user.following?.length || 0)) {
        this.logger.warn(
          `Mismatch detected! DB has ${followingCheck.following.length} following relations but loaded ${user.following?.length || 0}`,
        );
      }

      return user;
    } catch (error) {
      this.logger.error(`Error getting user by ID ${userId}:`, error);
      throw new Error(
        `Failed to load user data: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      this.logger.log(`Getting user by email: ${email}`);

      const user = await this.userRepository.findOne({
        where: { email },
      });

      if (!user) {
        this.logger.warn(`User not found: ${email}`);
        return null;
      }

      try {
        const userWithRelations = await this.userRepository.findOne({
          where: { email },
          relations: ['following', 'followers'],
        });
        return userWithRelations ?? user;
      } catch (relationError) {
        this.logger.warn(
          `Failed to load relations for user ${email}, returning basic user data ` +
            relationError,
        );
        return user;
      }
    } catch (error) {
      this.logger.error(`Error getting user by email ${email}:`, error);
      return null;
    }
  }

  async createUser(
    email: string,
    userName: string,
    password: string,
  ): Promise<{
    token: string;
    user: Pick<User, 'id' | 'email' | 'userName' | 'slug'>;
  }> {
    try {
      const passwordHash: string = await bcrypt.hash(password, 10);
      const user = this.userRepository.create({
        email,
        userName,
        passwordHash,
        slug: slugify(userName),
      });
      const savedUser = await this.userRepository.save(user);

      // --- Индексация в Elasticsearch ---
      await this.elasticsearchService.index({
        index: 'users',
        id: savedUser.id,
        document: {
          userName: savedUser.userName,
          email: savedUser.email,
          avatarUrl: savedUser.avatarUrl || '',
          avatarShape: savedUser.avatarShape || 'circle',
          slug: savedUser.slug,
        },
      });

      const payload = {
        sub: savedUser.id,
        email: savedUser.email,
        userName: savedUser.userName,
      };
      const token = this.jwtService.sign(payload);

      return {
        token,
        user: {
          id: savedUser.id,
          email: savedUser.email,
          userName: savedUser.userName,
          slug: savedUser.slug,
        },
      };
    } catch (error) {
      this.logger.error(`Error creating user:`, error);
      throw new Error(
        `Failed to create user: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateUser(
    userId: string,
    updateData: { userName?: string; email?: string; password?: string },
  ): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['following', 'followers'], // Загружаем связанные данные
      });

      if (!user) {
        return null;
      }

      // Обновляем только переданные поля
      if (updateData.userName !== undefined) {
        user.userName = updateData.userName;
        // Обновляем slug при изменении userName
        user.slug = slugify(updateData.userName);
      }
      if (updateData.email !== undefined) {
        user.email = updateData.email;
      }
      if (updateData.password !== undefined) {
        user.passwordHash = await bcrypt.hash(updateData.password, 10);
      }

      // Сохраняем изменения
      const updatedUser = await this.userRepository.save(user);

      // --- Обновление в Elasticsearch ---
      await this.elasticsearchService.update({
        index: 'users',
        id: updatedUser.id,
        doc: {
          userName: updatedUser.userName,
          email: updatedUser.email,
          avatarUrl: updatedUser.avatarUrl || '',
          avatarShape: updatedUser.avatarShape || 'circle',
          slug: updatedUser.slug,
        },
        doc_as_upsert: true,
      });

      this.logger.log(`User ${userId} updated successfully`);

      return updatedUser;
    } catch (error) {
      this.logger.error(`Error updating user ${userId}:`, error);
      return null;
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      const result = await this.userRepository.delete(userId);

      // --- Удаление из Elasticsearch ---
      await this.elasticsearchService.delete({
        index: 'users',
        id: userId,
      });

      return result.affected ? result.affected > 0 : false;
    } catch (error) {
      this.logger.error(`Error deleting user ${userId}:`, error);
      throw new Error(
        `Failed to delete user: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async findById(id: string) {
    try {
      return this.userRepository.findOne({ where: { id } });
    } catch (error) {
      this.logger.error(`Error finding user by ID ${id}:`, error);
    }
  }

  async findByEmail(email: string): Promise<User | undefined> {
    try {
      const user = await this.userRepository.findOne({ where: { email } });
      return user === null ? undefined : user;
    } catch (error) {
      this.logger.error(`Error finding user by email ${email}:`, error);
    }
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.findByEmail(email);
      if (user && (await bcrypt.compare(password, user.passwordHash))) {
        return user;
      }
      return null;
    } catch (error) {
      this.logger.error(`Error validating user ${email}:`, error);
      return null;
    }
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    token: string;
    user: Pick<User, 'id' | 'email' | 'userName' | 'slug'>;
  } | null> {
    try {
      const user = await this.validateUser(email, password);
      if (!user) return null;

      const payload = {
        sub: user.id,
        email: user.email,
        userName: user.userName,
      };
      const token = this.jwtService.sign(payload);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          userName: user.userName,
          slug: user.slug,
        },
      };
    } catch (error) {
      this.logger.error(`Error during login for ${email}:`, error);
      return null;
    }
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follower = await this.userRepository.findOne({
      where: { id: followerId },
      relations: ['following'],
    });

    if (!follower) {
      return false;
    }

    return follower.following?.some((f) => f.id === followingId) || false;
  }

  async getUserBySlug(slug: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { slug },
        relations: ['following', 'followers'],
      });
      if (!user) {
        this.logger.warn(`User not found by slug: ${slug}`);
        return null;
      }
      return user;
    } catch (error) {
      this.logger.error(`Error getting user by slug ${slug}:`, error);
      throw new Error(
        `Failed to load user data by slug: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async followUser(
    currentUserId: string,
    targetUserIdOrSlug: string,
  ): Promise<void> {
    try {
      // Получаем текущего пользователя
      const currentUser = await this.userRepository.findOne({
        where: { id: currentUserId },
      });

      if (!currentUser) {
        throw new Error('Current user not found');
      }

      // Получаем целевого пользователя по ID или slug
      let targetUser: User | null;

      if (isUUID(targetUserIdOrSlug)) {
        targetUser = await this.userRepository.findOne({
          where: { id: targetUserIdOrSlug },
        });
      } else {
        targetUser = await this.userRepository.findOne({
          where: { slug: targetUserIdOrSlug },
        });
      }

      if (!targetUser) {
        throw new Error('Target user not found');
      }

      if (currentUserId === targetUser.id) {
        throw new Error('Cannot follow yourself');
      }

      // Проверяем существование связи НАПРЯМУЮ через SQL
      const existingRelation = await this.userRepository.query(
        `SELECT * FROM user_following 
        WHERE "userId" = $1 AND "followingId" = $2`,
        [currentUserId, targetUser.id],
      );

      if (Array.isArray(existingRelation) && existingRelation.length > 0) {
        this.logger.log(
          `User ${currentUserId} is already following ${targetUser.id} (direct DB check)`,
        );
        return; // Уже подписан, ничего не делаем
      }

      // Добавляем связь напрямую через SQL с защитой от дублей
      await this.userRepository.query(
        `INSERT INTO user_following("userId", "followingId") 
        VALUES($1, $2) 
        ON CONFLICT DO NOTHING`,
        [currentUserId, targetUser.id],
      );

      this.logger.log(`User ${currentUserId} now following ${targetUser.id}`);
    } catch (error) {
      this.logger.error(`Error following user:`, error);
      throw new Error(
        `Failed to follow user: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async unfollowUser(
    currentUserId: string,
    targetUserIdOrSlug: string,
  ): Promise<void> {
    try {
      // Проверяем существование текущего пользователя
      const currentUser = await this.userRepository.findOne({
        where: { id: currentUserId },
      });

      if (!currentUser) {
        throw new Error('Current user not found');
      }

      // Получаем целевого пользователя по ID или slug
      let targetUser: User | null;

      if (isUUID(targetUserIdOrSlug)) {
        targetUser = await this.userRepository.findOne({
          where: { id: targetUserIdOrSlug },
        });
      } else {
        targetUser = await this.userRepository.findOne({
          where: { slug: targetUserIdOrSlug },
        });
      }

      if (!targetUser) {
        throw new Error('Target user not found');
      }

      if (currentUserId === targetUser.id) {
        throw new Error('Cannot unfollow yourself');
      }

      // Удаляем связь напрямую через SQL
      const result = await this.userRepository.query(
        `DELETE FROM user_following 
        WHERE "userId" = $1 AND "followingId" = $2`,
        [currentUserId, targetUser.id],
      ) as { affectedRows?: number }[];

      const deletedCount = Array.isArray(result) ? result.length : 0;

      this.logger.log(
        `User ${currentUserId} unfollowed ${targetUser.id}. Deleted ${deletedCount} rows`,
      );
    } catch (error) {
      this.logger.error(`Error unfollowing user:`, error);
      throw new Error(
        `Failed to unfollow user: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getFollowing(userId: string): Promise<User[]> {
    try {
      const result = await this.userRepository
        .createQueryBuilder('user')
        .where('user.id = :userId', { userId })
        .leftJoinAndSelect('user.following', 'following')
        .getOne();

      if (!result) {
        throw new Error('User not found');
      }

      const following = result.following || [];
      this.logger.log(
        `Retrieved ${following.length} following for user ${userId}`,
      );

      return following;
    } catch (error) {
      this.logger.error(`Error getting following for user ${userId}:`, error);
      throw new Error('Failed to get following users');
    }
  }

  async getFollowers(userId: string): Promise<User[]> {
    try {
      const result = await this.userRepository
        .createQueryBuilder('user')
        .where('user.id = :userId', { userId })
        .leftJoinAndSelect('user.followers', 'followers')
        .getOne();

      if (!result) {
        throw new Error('User not found');
      }

      const followers = result.followers || [];
      this.logger.log(
        `Retrieved ${followers.length} followers for user ${userId}`,
      );

      return followers;
    } catch (error) {
      this.logger.error(`Error getting followers for user ${userId}:`, error);
      throw new Error('Failed to get followers');
    }
  }

  async searchUsers(query: string, limit = 10): Promise<User[]> {
    try {
      const users = await this.userRepository
        .createQueryBuilder('user')
        .where('user.userName ILIKE :query OR user.email ILIKE :query', {
          query: `%${query}%`,
        })
        .limit(limit)
        .getMany();

      return users;
    } catch (error) {
      this.logger.error(`Error searching users with query "${query}":`, error);
      throw new Error('Failed to search users');
    }
  }
  // Добавьте этот метод для диагностики:

  async checkFollowingRelations(userId: string): Promise<{
    following: Array<{ userId: string; followingId: string }>;
    followers: Array<{ userId: string; followingId: string }>;
  }> {
    // Прямой SQL-запрос для проверки junction table
    const followingRelations = await this.userRepository.query(
      `SELECT * FROM user_following WHERE "userId" = $1`,
      [userId],
    ) as Array<{ userId: string; followingId: string }>;

    // Прямой SQL-запрос для проверки followers
    const followerRelations = await this.userRepository.query(
      `SELECT * FROM user_following WHERE "followingId" = $1`,
      [userId],
    ) as Array<{ userId: string; followingId: string }>;

    this.logger.log(
      `User ${userId} has ${followingRelations.length} following relations and ${followerRelations.length} follower relations in DB`,
    );

    return {
      following: followingRelations,
      followers: followerRelations,
    };
  }

  async updateUserAvatar(
    userId: string,
    avatarUrl?: string,
    avatarShape?: 'circle' | 'square',
  ): Promise<User | null> {
    try {
      const user = await this.findById(userId);
      if (!user) return null;

      if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
      if (avatarShape !== undefined) user.avatarShape = avatarShape;

      const updatedUser = await this.userRepository.save(user);

      // --- Обновление в Elasticsearch ---
      await this.elasticsearchService.update({
        index: 'users',
        id: updatedUser.id,
        doc: {
          avatarUrl: updatedUser.avatarUrl || '',
          avatarShape: updatedUser.avatarShape || 'circle',
        },
        doc_as_upsert: true,
      });

      return updatedUser;
    } catch (error) {
      this.logger.error(`Error updating user avatar ${userId}:`, error);
      return null;
    }
  }
}
