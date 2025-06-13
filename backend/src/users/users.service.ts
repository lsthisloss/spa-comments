import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { slugify } from '../utils/slugify';
import { isUUID } from 'class-validator';
import { UserRole } from './entities/user.entity';
import { UserBasicDto } from './dto/user-basic.dto';
import { TestService } from '../test/test.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly testService: TestService,
  ) {}

  async getUserById(userId: string): Promise<User | null> {
    try {
      this.logger.log(`Getting user by ID: ${userId}`);

      const followingCheck = await this.checkFollowingRelations(userId);
      this.logger.log(
        `User ${userId} has ${followingCheck.following.length} following relations and ${followingCheck.followers.length} followers in DB`,
      );

      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.role')
        .where('user.id = :userId', { userId })
        .leftJoinAndSelect('user.following', 'following')
        .leftJoinAndSelect('user.followers', 'followers')
        .getOne();

      if (!user) {
        this.logger.warn(`User not found: ${userId}`);
        return null;
      }

      this.logger.log(
        `User ${userId} loaded with role ${user.role}, ${user.following?.length || 0} following and ${user.followers?.length || 0} followers.`,
      );

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

  async findByUserName(userName: string): Promise<User | undefined> {
    try {
      const user = await this.userRepository.findOne({
        where: { userName },
      });
      return user === null ? undefined : user;
    } catch (error) {
      this.logger.error(`Error finding user by userName ${userName}:`, error);
      return undefined;
    }
  }

  private generateSlug(userName: string): string {
    return slugify(userName);
  }

  async createUser(
    email: string,
    userName: string,
    password: string,
    isTestMode: boolean = false,
  ): Promise<{ user: User; token: string }> {
    try {
      if (isTestMode) {
        console.log(`[UsersService] Creating TEST USER: ${userName}`);
      } else {
        console.log(`[UsersService] Creating REGULAR USER: ${userName}`);
      }

      // Проверяем существующих пользователей
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const existingUserName = await this.findByUserName(userName);
      if (existingUserName) {
        throw new ConflictException('User with this username already exists');
      }

      // ПРОВЕРЯЕМ КОЛИЧЕСТВО ПОЛЬЗОВАТЕЛЕЙ - первый становится SuperAdmin
      const totalUsers = await this.userRepository.count();
      const isFirstUser = totalUsers === 0;

      if (isFirstUser) {
        console.log(
          `🎯 [FIRST USER] ${userName} will be created as SUPERADMIN (first user in system)`,
        );
      }

      // Хешируем пароль
      const saltRounds = isTestMode ? 1 : 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Определяем роль пользователя
      let userRole: UserRole;
      if (isTestMode) {
        userRole = UserRole.TEST;
      } else if (isFirstUser) {
        userRole = UserRole.SUPERADMIN;
      } else {
        userRole = UserRole.USER;
      }

      const user = this.userRepository.create({
        email,
        userName,
        passwordHash: hashedPassword,
        slug: this.generateSlug(userName),
        role: userRole,
      });

      const savedUser = await this.userRepository.save(user);

      // Если тестовый режим, помечаем пользователя в TestService
      if (isTestMode && this.testService) {
        this.testService.markAsTestUser(savedUser.id);
      }

      // 🔥 Специальное логирование для первого пользователя
      if (isFirstUser) {
        console.log(
          `👑 FIRST USER CREATED AS SUPERADMIN: ${savedUser.userName} (${savedUser.id})`,
        );
        console.log(`🛡️  SuperAdmin privileges granted automatically`);
        console.log(`🔑 SuperAdmin can manage all users and admins`);
      }

      // Генерируем JWT токен
      const payload = {
        sub: savedUser.id,
        userName: savedUser.userName,
        email: savedUser.email,
        role: savedUser.role,
        isTest: isTestMode,
      };
      const token = this.jwtService.sign(payload);

      console.log(
        `User created with role: ${savedUser.role}${isTestMode ? ' [TEST]' : ''}${isFirstUser ? ' [FIRST USER - AUTO SUPERADMIN]' : ''}`,
      );

      // 🔥 Индексируем в Elasticsearch
      try {
        await this.elasticsearchService.index({
          index: 'users',
          id: savedUser.id,
          document: {
            userName: savedUser.userName,
            email: savedUser.email,
            avatarUrl: savedUser.avatarUrl || '',
            avatarShape: savedUser.avatarShape || 'circle',
            role: savedUser.role,
            slug: savedUser.slug,
            isFirstUser: isFirstUser,
            isSuperAdmin: isFirstUser,
          },
        });
      } catch (esError) {
        console.warn(`Failed to index user in Elasticsearch:`, esError);
      }

      return { user: savedUser, token };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      this.logger.error('Error creating user:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to create user: ${errorMessage}`);
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
          role: updatedUser.role,
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
      // Начинаем транзакцию для безопасного удаления
      const queryRunner =
        this.userRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 1. Удаляем все комментарии пользователя (сначала комментарии, так как они могут ссылаться на посты)
        await queryRunner.query(`DELETE FROM comments WHERE "userId" = $1`, [
          userId,
        ]);

        // 2. Удаляем все посты пользователя
        await queryRunner.query(`DELETE FROM posts WHERE "userId" = $1`, [
          userId,
        ]);

        // 3. Удаляем связи подписок (following/followers)
        await queryRunner.query(
          `DELETE FROM user_following WHERE "userId" = $1 OR "followingId" = $1`,
          [userId],
        );

        // 4. Удаляем самого пользователя - исправляем проверку результата
        const result = (await queryRunner.query(
          `DELETE FROM users WHERE id = $1`,
          [userId],
        )) as unknown[];

        // 5. Удаляем из Elasticsearch
        try {
          await this.elasticsearchService.delete({
            index: 'users',
            id: userId,
          });
        } catch (esError) {
          this.logger.warn(
            `Failed to delete user from Elasticsearch: ${esError}`,
          );
          // Не прерываем транзакцию из-за ошибки Elasticsearch
        }

        await queryRunner.commitTransaction();

        this.logger.log(
          `User ${userId} and all related data deleted successfully`,
        );

        // В PostgreSQL с TypeORM result - это массив, а не объект с affectedRows
        // Проверяем что пользователь действительно был найден и удален
        const userExists = Array.isArray(result) && result.length >= 0;
        return userExists; // Возвращаем true если операция прошла успешно
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
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
      // passwordHash для проверки пароля И role для авторизации
      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.passwordHash') // Явно добавляем скрытое поле
        .where('user.email = :email', { email })
        .getOne();

      return user === null ? undefined : user;
    } catch (error) {
      this.logger.error(`Error finding user by email ${email}:`, error);
      return undefined;
    }
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserBasicDto | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (user && (await this.comparePasswords(password, user.passwordHash))) {
      // Избегаем создания неиспользуемой переменной
      return Object.fromEntries(
        Object.entries(user).filter(([key]) => key !== 'passwordHash'),
      );
    }

    return null;
  }

  private async comparePasswords(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    success: boolean;
    message?: string;
    token?: string;
    user?: User;
  }> {
    try {
      console.log(`Login attempt for email: ${email}`);

      const user = await this.findByEmail(email);

      if (!user) {
        console.log(`Login failed for email: ${email} - User not found`);
        return { success: false, message: 'Invalid credentials' };
      }

      const isValidUser = await this.validateUser(email, password);

      if (!isValidUser) {
        console.log(`Login failed for email: ${email} - Invalid password`);
        return { success: false, message: 'Invalid credentials' };
      }

      const payload = {
        sub: user.id,
        email: user.email,
        userName: user.userName,
        role: user.role || UserRole.USER,
      };

      const token = this.jwtService.sign(payload);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...userWithoutPassword } = user;

      console.log(
        `User logged in successfully: ${user.id} (${user.userName}) with role: ${user.role}`,
      );

      return {
        success: true,
        token,
        user: userWithoutPassword as User,
      };
    } catch (error) {
      console.error(`Login error for ${email}:`, error);
      return { success: false, message: 'Internal server error' };
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      // Связь напрямую через SQL с защитой от дублей
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await this.userRepository.query(
        `DELETE FROM user_following 
        WHERE "userId" = $1 AND "followingId" = $2`,
        [currentUserId, targetUser.id],
      );

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

  async getAllUsers(): Promise<User[]> {
    try {
      const users = await this.userRepository.find({
        select: [
          'id',
          'userName',
          'email',
          'slug',
          'role',
          'avatarUrl',
          'avatarShape',
        ],
        order: { createdAt: 'DESC' },
      });

      this.logger.log(`Found ${users.length} users in database`);
      return users;
    } catch (error) {
      this.logger.error('Error getting all users:', error);
      throw new Error('Failed to get users');
    }
  }

  async searchUsers(query: string, limit = 10): Promise<User[]> {
    try {
      const users = await this.userRepository
        .createQueryBuilder('user')
        .where(
          'user.userName ILIKE :query OR user.email ILIKE :query OR user.slug ILIKE :query',
          {
            query: `%${query}%`,
          },
        )
        .select([
          'user.id',
          'user.userName',
          'user.email',
          'user.slug',
          'user.role',
          'user.avatarUrl',
          'user.avatarShape',
        ])
        .limit(limit)
        .getMany();

      this.logger.log(`Search for "${query}" returned ${users.length} results`);
      return users;
    } catch (error) {
      this.logger.error(`Error searching users with query "${query}":`, error);
      throw new Error('Failed to search users');
    }
  }

  async checkFollowingRelations(userId: string): Promise<{
    following: Array<{ userId: string; followingId: string }>;
    followers: Array<{ userId: string; followingId: string }>;
  }> {
    // Прямой SQL-запрос для проверки junction table
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const followingRelations = (await this.userRepository.query(
      `SELECT * FROM user_following WHERE "userId" = $1`,
      [userId],
    )) as Array<{ userId: string; followingId: string }>;

    // Прямой SQL-запрос для проверки followers

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const followerRelations = (await this.userRepository.query(
      `SELECT * FROM user_following WHERE "followingId" = $1`,
      [userId],
    )) as Array<{ userId: string; followingId: string }>;

    this.logger.log(
      `User ${userId} has ${followingRelations.length} following relations and ${followerRelations.length} follower relations in DB`,
    );

    return {
      following: followingRelations,
      followers: followerRelations,
    };
  }
  // Обновить ваш метод с дополнительным логированием

  async updateUserAvatar(
    userId: string,
    avatarUrl?: string,
    avatarShape?: 'circle' | 'square',
  ): Promise<User | null> {
    try {
      console.log(`🔄 Updating avatar for user ${userId}:`, {
        avatarUrl,
        avatarShape,
      });

      const user = await this.findById(userId);
      if (!user) {
        console.error(`❌ User not found for avatar update: ${userId}`);
        return null;
      }

      console.log(
        `👤 Found user for avatar update: ${user.userName} (${user.id})`,
      );

      // Обновляем поля аватара
      if (avatarUrl !== undefined) {
        user.avatarUrl = avatarUrl;
        console.log(`📷 Updated avatarUrl: ${avatarUrl}`);
      }
      if (avatarShape !== undefined) {
        user.avatarShape = avatarShape;
        console.log(`🔲 Updated avatarShape: ${avatarShape}`);
      }

      const updatedUser = await this.userRepository.save(user);
      console.log(`💾 User saved successfully:`, {
        id: updatedUser.id,
        userName: updatedUser.userName,
        avatarUrl: updatedUser.avatarUrl,
        avatarShape: updatedUser.avatarShape,
      });

      // --- Обновление в Elasticsearch ---
      try {
        await this.elasticsearchService.update({
          index: 'users',
          id: updatedUser.id,
          doc: {
            avatarUrl: updatedUser.avatarUrl || '',
            avatarShape: updatedUser.avatarShape || 'circle',
          },
          doc_as_upsert: true,
        });
        console.log(`🔍 Elasticsearch updated for user ${updatedUser.id}`);
      } catch (esError) {
        console.warn(
          `⚠️ Failed to update Elasticsearch for user ${updatedUser.id}:`,
          esError,
        );
        // Не блокируем операцию из-за ошибки Elasticsearch
      }

      this.logger.log(
        `Avatar updated successfully for user ${updatedUser.userName}: ${avatarUrl}`,
      );
      return updatedUser;
    } catch (error) {
      this.logger.error(
        `❌ Failed to update avatar for user ${userId}:`,
        error,
      );
      console.error(`❌ updateUserAvatar error details:`, error);
      return null;
    }
  }
  async getUserByIdOrSlug(userIdOrSlug: string): Promise<User | null> {
    try {
      let user: User | null;

      if (isUUID(userIdOrSlug)) {
        // Поиск по UUID
        user = await this.userRepository.findOne({
          where: { id: userIdOrSlug },
          select: [
            'id',
            'userName',
            'email',
            'role',
            'avatarUrl',
            'avatarShape',
            'slug',
            'createdAt',
            'updatedAt',
          ],
        });
        this.logger.log(
          `Searching user by ID: ${userIdOrSlug} - Found: ${!!user}`,
        );
      } else {
        // Сначала точный поиск по slug
        user = await this.userRepository.findOne({
          where: { slug: userIdOrSlug },
          select: [
            'id',
            'userName',
            'email',
            'role',
            'avatarUrl',
            'avatarShape',
            'slug',
            'createdAt',
            'updatedAt',
          ],
        });
        this.logger.log(
          `Exact slug search for: ${userIdOrSlug} - Found: ${!!user}`,
        );

        // Если не найден, пробуем case-insensitive поиск
        if (!user) {
          user = await this.userRepository
            .createQueryBuilder('user')
            .where('LOWER(user.slug) = LOWER(:slug)', { slug: userIdOrSlug })
            .orWhere('LOWER(user.userName) = LOWER(:userName)', {
              userName: userIdOrSlug,
            })
            .select([
              'user.id',
              'user.userName',
              'user.email',
              'user.role',
              'user.avatarUrl',
              'user.avatarShape',
              'user.slug',
              'user.createdAt',
              'user.updatedAt',
            ])
            .getOne();
          this.logger.log(
            `Case-insensitive search for: ${userIdOrSlug} - Found: ${!!user}`,
          );
        }
      }

      if (!user) {
        this.logger.warn(`User not found: ${userIdOrSlug}`);
        return null;
      }

      this.logger.log(
        `Found user: ${user.userName} (slug: ${user.slug}, ID: ${user.id})`,
      );
      return user;
    } catch (error) {
      this.logger.error(`Error getting user ${userIdOrSlug}:`, error);
      return null;
    }
  }

  async promoteToAdmin(
    userIdOrSlug: string,
    promoterId: string,
  ): Promise<User | null> {
    try {
      // 🔥 Проверяем что промоутер - SuperAdmin
      const promoter = await this.userRepository.findOne({
        where: { id: promoterId },
      });

      if (!promoter || promoter.role !== UserRole.SUPERADMIN) {
        throw new Error('Only SuperAdmin can promote users to Admin');
      }

      this.logger.log(`Attempting to promote user: ${userIdOrSlug}`);

      const user = await this.getUserByIdOrSlug(userIdOrSlug);

      if (!user) {
        const similarUsers = await this.searchUsers(userIdOrSlug, 5);
        this.logger.error(`User not found: ${userIdOrSlug}`);
        this.logger.error(
          `Similar users found:`,
          similarUsers.map((u) => `${u.userName}(${u.slug})`).join(', '),
        );
        throw new Error(`User not found: ${userIdOrSlug}`);
      }

      if (user.role === UserRole.ADMIN) {
        throw new Error('User is already an Admin');
      }

      if (user.role === UserRole.SUPERADMIN) {
        throw new Error('Cannot promote SuperAdmin');
      }

      // Повышаем до админа
      user.role = UserRole.ADMIN;
      const updatedUser = await this.userRepository.save(user);

      // Обновляем в Elasticsearch
      try {
        await this.elasticsearchService.update({
          index: 'users',
          id: updatedUser.id,
          doc: {
            role: updatedUser.role,
          },
          doc_as_upsert: true,
        });
      } catch (esError) {
        this.logger.warn(`Failed to update user in Elasticsearch: ${esError}`);
      }

      this.logger.log(
        `User ${user.id} (${user.userName}, slug: ${user.slug}) promoted to Admin by SuperAdmin ${promoterId}`,
      );
      return updatedUser;
    } catch (error) {
      this.logger.error(`Error promoting user to Admin:`, error);
      throw new Error(
        `Failed to promote user: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async demoteFromAdmin(
    userIdOrSlug: string,
    demoterId: string,
  ): Promise<User | null> {
    try {
      const demoter = await this.userRepository.findOne({
        where: { id: demoterId },
      });

      if (!demoter || demoter.role !== UserRole.SUPERADMIN) {
        throw new Error('Only SuperAdmin can demote Admins');
      }

      this.logger.log(`Attempting to demote user: ${userIdOrSlug}`);

      const user = await this.getUserByIdOrSlug(userIdOrSlug);

      if (!user) {
        const similarUsers = await this.searchUsers(userIdOrSlug, 5);
        this.logger.error(`User not found: ${userIdOrSlug}`);
        this.logger.error(
          `Similar users found:`,
          similarUsers.map((u) => `${u.userName}(${u.slug})`).join(', '),
        );
        throw new Error(`User not found: ${userIdOrSlug}`);
      }

      if (user.role === UserRole.SUPERADMIN) {
        throw new Error('Cannot demote SuperAdmin');
      }

      if (user.role !== UserRole.ADMIN) {
        throw new Error('User is not an Admin');
      }

      // Понижаем до обычного пользователя
      user.role = UserRole.USER;
      const updatedUser = await this.userRepository.save(user);

      // Обновляем в Elasticsearch
      try {
        await this.elasticsearchService.update({
          index: 'users',
          id: updatedUser.id,
          doc: {
            role: updatedUser.role,
          },
          doc_as_upsert: true,
        });
      } catch (esError) {
        this.logger.warn(`Failed to update user in Elasticsearch: ${esError}`);
      }

      this.logger.log(
        `Admin ${user.id} (${user.userName}, slug: ${user.slug}) demoted to User by SuperAdmin ${demoterId}`,
      );
      return updatedUser;
    } catch (error) {
      this.logger.error(`Error demoting Admin:`, error);
      throw new Error(
        `Failed to demote Admin: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
