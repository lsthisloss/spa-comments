import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { LoginUserDto } from './dto/login-user.dto';
import { Socket, Server } from 'socket.io';
import { AuthenticatedSocketData } from '../auth/jwt-payload.interface';
import { CommonWsService } from 'src/common/common-ws.service';

interface AvatarUploadData {
  file: {
    name: string;
    type: string;
    base64: string;
  };
  avatarShape: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/users' })
export class UsersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly usersService: UsersService,
    private readonly commonWsService: CommonWsService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`User client connected: ${client.id}`);
    // Проверяем аутентификацию
    const userData = client.data as AuthenticatedSocketData | undefined;
    if (userData?.user?.id) {
      console.log(
        `Authenticated user connected: ${userData.user.id} (${userData.user.userName})`,
      );
    } else {
      console.log(`Anonymous user connected: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log('User WS disconnected:', client.id);
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

  @SubscribeMessage('getUser')
  async handleGetUser(@MessageBody() data: { userId: string }) {
    try {
      console.log(`Getting user data for ID: ${data.userId}`);

      const user = await this.usersService.getUserById(data.userId);
      if (user) {
        const { id, email, userName, following, followers } = user;
        console.log(`User data retrieved: ${id} (${userName})`);
        return {
          success: true,
          user: {
            id,
            email,
            userName,
            following: following || [],
            followers: followers || [],
          },
        };
      }
      console.log(`User not found: ${data.userId}`);
      return { success: false, message: 'User not found' };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Get user failed';
      console.error('Get user error:', message);
      return { success: false, message };
    }
  }

  @SubscribeMessage('login')
  async handleLogin(@MessageBody() dto: LoginUserDto) {
    try {
      console.log(`Login attempt for email: ${dto.email}`);

      const result = await this.usersService.login(dto.email, dto.password);

      if (result) {
        console.log(
          `User logged in successfully: ${result.user.id} (${result.user.userName})`,
        );
        return { success: true, token: result.token, user: result.user };
      } else {
        console.log(`Login failed for email: ${dto.email}`);
        return { success: false, message: 'Invalid credentials' };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      console.error('Login error:', message);
      return { success: false, message };
    }
  }

  private validateAvatarShape(shape: string | undefined): 'circle' | 'square' {
    if (shape === 'circle' || shape === 'square') {
      return shape;
    }
    return 'circle';
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('uploadAvatar')
  async handleUploadAvatar(
    @MessageBody() data: AvatarUploadData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Получаем ID пользователя из JWT
      const userData = client.data as AuthenticatedSocketData;
      const userId = userData.user.id;

      if (!userId) {
        console.error('Upload avatar failed: Not authenticated');
        return { success: false, message: 'Not authenticated' };
      }

      if (!data.file || !data.file.base64) {
        console.error('Upload avatar failed: Invalid file data');
        return { success: false, message: 'Invalid file data' };
      }
      const validatedShape = this.validateAvatarShape(data.avatarShape);

      // Обрабатываем загрузку аватара через CommonWsService
      const { avatarUrl } = this.commonWsService.processAvatarUpload(
        { file: data.file },
        userId,
        validatedShape, // Передаем валидированное значение
      );

      // Обновляем пользователя с новым аватаром
      const updatedUser = await this.usersService.updateUserAvatar(
        userId,
        avatarUrl,
        validatedShape,
      );

      if (updatedUser) {
        console.log(`User avatar uploaded successfully: ${updatedUser.id}`);
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

      return { success: false, message: 'Failed to update avatar' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      console.error('uploadAvatar: Error =', message);
      return { success: false, message };
    }
  }

  // Добавьте обработчик для обновления только формы аватара
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('updateAvatarShape')
  async handleUpdateAvatarShape(
    @MessageBody() data: { avatarShape: string }, // Изменили тип на string
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
}
