import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { Socket, Server } from 'socket.io';
import { AuthenticatedSocketData } from '../auth/jwt-payload.interface';
import { User } from './entities/user.entity';
import { WsThrottlerGuard } from '../common/guards/ws-throttler.guard';
import { CommonWsService } from '../common/common-ws.service';
import { SessionService } from '../auth/session.service';
import { RequestPatternGuard } from '../common/guards/request-pattern.guard';

@UseGuards(WsThrottlerGuard, RequestPatternGuard)
@WebSocketGateway({
  namespace: '/users',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class UsersGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly usersService: UsersService,
    private readonly commonWsService: CommonWsService,
    private readonly sessionService: SessionService,
  ) {
    console.log('[UsersGateway] Constructor called');
  }

  afterInit() {
    console.log('[UsersGateway] Users namespace initialized');
    console.log('[UsersGateway] Server object available:', !!this.server);
  }

  handleConnection(client: Socket) {
    console.log('='.repeat(50));
    console.log(`[UsersGateway] 🔌 NEW CONNECTION DETECTED`);
    console.log(`[UsersGateway] Client ID: ${client.id}`);
    console.log(`[UsersGateway] Namespace: ${client.nsp.name}`);
    console.log(`[UsersGateway] Transport: ${client.conn.transport.name}`);
    console.log(`[UsersGateway] Client address: ${client.handshake.address}`);
    console.log(`[UsersGateway] Query params:`, client.handshake.query);
    console.log(`[UsersGateway] Headers:`, client.handshake.headers);
    console.log('='.repeat(50));
  }

  handleDisconnect(client: Socket) {
    console.log(`[UsersGateway] ❌ Client disconnected: ${client.id}`);
  }

  // Добавим простой тестовый метод
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    console.log(`[UsersGateway] Ping received from ${client.id}`);
    client.emit('pong', { message: 'Hello from UsersGateway!' });
  }
  @SubscribeMessage('login')
  async handleLogin(
    @MessageBody() data: { email: string; password: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const result = await this.usersService.login(data.email, data.password);

      if (result.success && result.user && result.token) {
        // Безопасно извлекаем данные пользователя
        const userResponse = {
          id: result.user.id,
          userName: result.user.userName,
          email: result.user.email,
          avatarUrl: result.user.avatarUrl || null,
          avatarShape: result.user.avatarShape || 'circle',
          slug: result.user.slug,
          role: result.user.role,
          createdAt: result.user.createdAt,
          updatedAt: result.user.updatedAt,
        };

        console.log(
          `[LOGIN SUCCESS] User: ${userResponse.userName}, Role: ${userResponse.role}`,
        );

        // Проверяем, есть ли уже активная сессия
        const existingSession = this.sessionService.registerSession(
          result.user.id,
          result.user.userName,
          client,
        );

        // Если была активная сессия, отключаем её
        if (existingSession) {
          console.log(
            `[LOGIN] Terminating previous session for user ${result.user.userName}`,
          );
          this.sessionService.disconnectUser(
            result.user.id,
            'Ваша учетная запись была открыта на другом устройстве. Если это были не вы, возможно ваша учетная запись была скомпрометирована.',
          );
        }

        // Отправляем ответ новому клиенту
        client.emit('loginResponse', {
          success: true,
          token: result.token,
          user: userResponse,
        });
      } else {
        client.emit('loginResponse', {
          success: false,
          message: result.message || 'Login failed',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      client.emit('loginResponse', {
        success: false,
        message: 'Internal server error',
      });
    }
  }

  @SubscribeMessage('register')
  async handleRegister(@MessageBody() dto: CreateUserDto) {
    try {
      console.log(`
        Registration attempt for email: ${dto.email}, userName: ${dto.userName}`);
      const { token, user } = await this.usersService.createUser(
        dto.email,
        dto.userName,
        dto.password,
      );

      console.log(
        `User registered successfully: ${user.id} (${user.userName})`,
      );
      return { success: true, user, token };
    } catch (error: unknown) {
      let message = 'Internal server error';
      if (
        error &&
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
      ) {
        message = (error as { message: string }).message;
      }
      console.error('Registration error:', message);
      return { success: false, message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('updateUser')
  async handleUpdateUser(
    @MessageBody()
    data: {
      userId: string;
      userName?: string;
      email?: string;
      password?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userData = client.data as AuthenticatedSocketData;
      const currentUserId = userData.user.id;

      console.log(
        'updateUser: currentUserId =',
        currentUserId,
        'requestedUserId =',
        data.userId,
      );

      if (!currentUserId) {
        console.error('Update user failed: Not authenticated');
        return { success: false, message: 'Not authenticated' };
      }

      if (currentUserId !== data.userId) {
        console.error('Update user failed: Unauthorized access attempt');
        return { success: false, message: 'Unauthorized' };
      }

      const updatedUser = await this.usersService.updateUser(data.userId, {
        userName: data.userName,
        email: data.email,
        password: data.password,
      });

      if (updatedUser) {
        console.log(
          `User updated successfully: ${updatedUser.id} (${updatedUser.userName})`,
        );
        return {
          success: true,
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            userName: updatedUser.userName,
          },
        };
      }

      console.error('Update user failed: Service returned null');
      return { success: false, message: 'Failed to update user' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Update failed';
      console.error('updateUser: Error =', message);
      return { success: false, message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('followUser')
  async handleFollowUser(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userData = client.data as AuthenticatedSocketData;
      const followerId = userData.user.id;

      console.log(`Follow request - Client data:`, userData);
      console.log(
        `Follow request - Follower ID: ${followerId}, Target: ${data.userId}`,
      );

      if (!followerId) {
        console.error('Follow user failed: User not authenticated');
        return { success: false, error: 'User not authenticated' };
      }

      if (followerId === data.userId) {
        console.error('Follow user failed: Cannot follow yourself');
        return { success: false, error: 'Cannot follow yourself' };
      }

      console.log(`User ${followerId} trying to follow ${data.userId}`);

      await this.usersService.followUser(followerId, data.userId);

      const isNowFollowing = await this.usersService.isFollowing(
        followerId,
        data.userId,
      );
      console.log(
        `Follow result: ${followerId} -> ${data.userId} = ${isNowFollowing}`,
      );

      const following = await this.usersService.getFollowing(followerId);
      console.log(
        `User ${followerId} is now following:`,
        following.map((u) => `${u.id} (${u.userName})`),
      );

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Follow failed';
      console.error('Error following user:', message);
      return { success: false, error: message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('getFollowing')
  async handleGetFollowing(@ConnectedSocket() client: Socket) {
    try {
      const userData = client.data as AuthenticatedSocketData;
      const userId = userData.user.id;

      console.log(`Getting following list for user: ${userId}`);

      if (!userId) {
        console.error('Get following failed: User not authenticated');
        return { success: false, error: 'User not authenticated' };
      }

      const following = await this.usersService.getFollowing(userId);

      console.log(
        `User ${userId} following:`,
        following.map((u) => `${u.id} (${u.userName})`),
      );

      return {
        success: true,
        following: following.map((u) => ({
          id: u.id,
          userName: u.userName,
          email: u.email,
        })),
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Get following failed';
      console.error('Error getting following:', message);
      return { success: false, error: message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('unfollowUser')
  async handleUnfollowUser(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userData = client.data as AuthenticatedSocketData;
      const currentUserId = userData.user.id;

      console.log(
        `Unfollow request - Follower ID: ${currentUserId}, Target: ${data.userId}`,
      );

      if (!currentUserId) {
        console.error('Unfollow user failed: Not authenticated');
        return { success: false, error: 'Not authenticated' };
      }

      if (currentUserId === data.userId) {
        console.error('Unfollow user failed: Cannot unfollow yourself');
        return { success: false, error: 'Cannot unfollow yourself' };
      }

      console.log(`User ${currentUserId} trying to unfollow ${data.userId}`);

      await this.usersService.unfollowUser(currentUserId, data.userId);

      console.log(
        `User ${currentUserId} successfully unfollowed ${data.userId}`,
      );
      return { success: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unfollow failed';
      console.error('Error unfollowing user:', message);
      return { success: false, error: message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('deleteUser')
  async handleDeleteUser(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userData = client.data as AuthenticatedSocketData;
      const currentUserId = userData.user.id;

      console.log(
        `Delete user request - Current: ${currentUserId}, Target: ${data.userId}`,
      );

      if (!currentUserId) {
        console.error('Delete user failed: Not authenticated');
        return { success: false, message: 'Not authenticated' };
      }

      if (currentUserId !== data.userId) {
        console.error('Delete user failed: Unauthorized access attempt');
        return { success: false, message: 'Unauthorized' };
      }

      console.log(`User ${currentUserId} trying to delete their account`);

      const result = await this.usersService.deleteUser(data.userId);

      if (result) {
        console.log(`User ${data.userId} deleted successfully`);
        return { success: true, message: 'User deleted' };
      } else {
        console.error('Delete user failed: Service returned false');
        return { success: false, message: 'Failed to delete user' };
      }
    } catch (error: unknown) {
      let message = 'Internal server error';
      if (
        error &&
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
      ) {
        message = (error as { message: string }).message;
      }
      console.error('Delete user error:', message);
      return { success: false, message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('uploadAvatar')
  async handleUploadAvatar(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      file: { name: string; type: string; base64: string };
      avatarShape?: 'circle' | 'square';
    },
  ) {
    try {
      const userData = client.data as {
        user?: { id: string; userName: string };
      };
      const userId = userData.user?.id;

      if (!userId) {
        client.emit('avatarUploaded', {
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      console.log(`[AVATAR] Processing avatar upload for user ${userId}`);

      // Проверяем тестовую генерацию данных
      const isTestDataGeneration =
        client.handshake?.query?.testDataGeneration === 'true';

      // Обрабатываем аватар - ДОБАВЛЯЕМ AWAIT!
      const result = await this.commonWsService.processAvatarUpload(
        { file: data.file },
        userId,
        data.avatarShape || 'circle',
      );

      if (!result) {
        client.emit('avatarUploaded', {
          success: false,
          message: 'Failed to process avatar',
        });
        return;
      }

      // Обновляем пользователя в БД (ТОЛЬКО для реального режима)
      if (!isTestDataGeneration) {
        const updatedUser = await this.usersService.updateUserAvatar(
          userId,
          result.avatarUrl,
          result.avatarShape as 'circle' | 'square',
        );

        if (!updatedUser) {
          client.emit('avatarUploaded', {
            success: false,
            message: 'Failed to update user avatar',
          });
          return;
        }

        console.log(`[AVATAR] User avatar updated in DB: ${result.avatarUrl}`);
      } else {
        console.log(`[AVATAR] Test data generation - skipping DB update`);
      }

      // Отправляем успешный ответ
      client.emit('avatarUploaded', {
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: result.avatarUrl,
        avatarShape: result.avatarShape,
        user: {
          id: userId,
          userName: userData.user?.userName,
          avatarUrl: result.avatarUrl,
          avatarShape: result.avatarShape,
        },
      });

      console.log(
        `[AVATAR] Avatar upload completed for user ${userId}: ${result.avatarUrl}`,
      );
    } catch (error) {
      console.error('[AVATAR] Avatar upload error:', error);
      client.emit('avatarUploaded', {
        success: false,
        message:
          error instanceof Error ? error.message : 'Avatar upload failed',
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('updateAvatarShape')
  async handleUpdateAvatarShape(
    @MessageBody() data: { avatarShape: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userData = client.data as AuthenticatedSocketData;
      const userId = userData.user.id;

      if (!userId) {
        console.error('Update avatar shape failed: Not authenticated');
        return { success: false, message: 'Not authenticated' };
      }

      // Валидируем значение avatarShape
      const validatedShape = this.validateAvatarShape(data.avatarShape);

      // Обновляем только форму аватара, оставляя URL прежним
      const updatedUser = await this.usersService.updateUserAvatar(
        userId,
        undefined, // URL не меняем
        validatedShape, // Передаем валидированное значение
      );

      if (updatedUser) {
        console.log(
          `User avatar shape updated successfully: ${updatedUser.id}`,
        );
        return {
          success: true,
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            userName: updatedUser.userName,
            avatarUrl: updatedUser.avatarUrl,
            avatarShape: updatedUser.avatarShape,
          },
        };
      }

      return { success: false, message: 'Failed to update avatar shape' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Update failed';
      console.error('updateAvatarShape: Error =', message);
      return { success: false, message };
    }
  }

  private validateAvatarShape(shape: any): 'circle' | 'square' {
    if (shape === 'square') return 'square';
    return 'circle';
  }
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('promoteToAdmin')
  async handlePromoteToAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string }, // userId может быть slug
  ): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const userData = client.data as AuthenticatedSocketData;
      const promoterId = userData.user.id;

      if (!promoterId) {
        return { success: false, message: 'User not authenticated' };
      }

      console.log(`Promoting user ${data.userId} to Admin by ${promoterId}`);

      const updatedUser = await this.usersService.promoteToAdmin(
        data.userId, // Передаем userIdOrSlug
        promoterId,
      );

      if (updatedUser) {
        // Уведомляем всех подключенных пользователей об изменении роли
        this.server.emit('userRoleUpdated', {
          userId: updatedUser.id,
          userName: updatedUser.userName,
          newRole: updatedUser.role,
          action: 'promoted',
        });

        console.log(
          `Successfully promoted ${updatedUser.userName} (${updatedUser.id}) to Admin`,
        );

        return {
          success: true,
          user: updatedUser,
          message: `User ${updatedUser.userName} promoted to Admin`,
        };
      } else {
        return { success: false, message: 'Failed to promote user' };
      }
    } catch (error) {
      console.error(
        `promoteToAdmin: ${error instanceof Error ? error.constructor.name : 'Error'} = ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to promote user',
      };
    }
  }

  @SubscribeMessage('demoteFromAdmin')
  async handleDemoteFromAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string }, // userId может быть slug
  ): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const userData = client.data as AuthenticatedSocketData;
      const demoterId = userData.user.id;

      if (!demoterId) {
        return { success: false, message: 'User not authenticated' };
      }

      console.log(`Demoting user ${data.userId} from Admin by ${demoterId}`);

      const updatedUser = await this.usersService.demoteFromAdmin(
        data.userId, // Передаем userIdOrSlug
        demoterId,
      );

      if (updatedUser) {
        // Уведомляем всех подключенных пользователей об изменении роли
        this.server.emit('userRoleUpdated', {
          userId: updatedUser.id,
          userName: updatedUser.userName,
          newRole: updatedUser.role,
          action: 'demoted',
        });

        console.log(
          `Successfully demoted ${updatedUser.userName} (${updatedUser.id}) from Admin`,
        );

        return {
          success: true,
          user: updatedUser,
          message: `User ${updatedUser.userName} demoted from Admin`,
        };
      } else {
        return { success: false, message: 'Failed to demote user' };
      }
    } catch (error) {
      console.error(
        `demoteFromAdmin: ${error instanceof Error ? error.constructor.name : 'Error'} = ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to demote admin',
      };
    }
  }

  @SubscribeMessage('getUser')
  async handleGetUser(
    @MessageBody() data: { userId: string },
  ): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      console.log(`Getting user: ${data.userId}`);

      const user = await this.usersService.getUserByIdOrSlug(data.userId); // Используем новый метод

      if (user) {
        return { success: true, user };
      } else {
        return { success: false, message: 'User not found' };
      }
    } catch (error) {
      console.error(`Error getting user ${data.userId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get user',
      };
    }
  }
  @SubscribeMessage('getAllUsers')
  async handleGetAllUsers(): Promise<{
    success: boolean;
    users?: User[];
    message?: string;
  }> {
    try {
      const users = await this.usersService.getAllUsers();
      return { success: true, users };
    } catch (error) {
      console.error('Error getting all users:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get users',
      };
    }
  }

  @SubscribeMessage('searchUsers')
  async handleSearchUsers(
    @MessageBody() data: { query: string },
  ): Promise<{ success: boolean; users?: User[]; message?: string }> {
    try {
      const users = await this.usersService.searchUsers(data.query, 20);
      console.log(
        `Search results for "${data.query}":`,
        users.map((u) => `${u.userName} (${u.slug})`),
      );
      return { success: true, users };
    } catch (error) {
      console.error('Error searching users:', error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to search users',
      };
    }
  }
}
