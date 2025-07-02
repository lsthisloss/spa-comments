import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

interface ActiveSession {
  userId: string;
  userName: string;
  sockets: Map<string, Socket>; // множественные сокеты
  timestamp: number;
}

@Injectable()
export class SessionService {
  private activeSessions = new Map<string, ActiveSession>();
  private socketToUser = new Map<string, string>();

  // Новый метод для проверки существующей сессии
  getExistingSession(userId: string): ActiveSession | null {
    const session = this.activeSessions.get(userId);
    
    console.log(`[SessionService] Checking existing session for ${userId}: ${session ? `found with ${session.sockets.size} sockets` : 'not found'}`);
    
    if (!session) {
      return null;
    }

    // Возвращаем копию сессии, чтобы избежать случайных изменений
    return {
      userId: session.userId,
      userName: session.userName,
      sockets: new Map(session.sockets), // Создаем копию Map
      timestamp: session.timestamp,
    };
  }

  registerSession(
    userId: string,
    userName: string,
    socket: Socket,
  ): void {
    console.log(`[SessionService] Registering session for user ${userName} (${userId}) on socket ${socket.id}`);
    
    // Сначала отключаем все существующие сессии для этого пользователя
    const existingSession = this.activeSessions.get(userId);
    if (existingSession) {
      console.log(
        `[SessionService] Found existing session for user ${userName} with ${existingSession.sockets.size} sockets - force disconnecting`,
      );
      
      // Отключаем все старые сокеты
      for (const [socketId, oldSocket] of existingSession.sockets) {
        console.log(`[SessionService] Force disconnecting socket ${socketId}`);
        try {
          oldSocket.emit('forcedLogout', {
            reason: 'Ваша учетная запись была открыта на другом устройстве. Если это были не вы, возможно ваша учетная запись была скомпрометирована.',
            timestamp: new Date().toISOString(),
          });
          oldSocket.disconnect(true);
        } catch (error) {
          console.error(`[SessionService] Error disconnecting socket ${socketId}:`, error);
        }
        this.socketToUser.delete(socketId);
      }
      
      // Очищаем старую сессию немедленно
      this.activeSessions.delete(userId);
      console.log(`[SessionService] Removed old session for user ${userName}`);
    } else {
      console.log(`[SessionService] No existing session found for user ${userName}`);
    }

    // Создаем новую сессию
    const newSession: ActiveSession = {
      userId,
      userName,
      sockets: new Map([[socket.id, socket]]),
      timestamp: Date.now(),
    };

    this.activeSessions.set(userId, newSession);
    this.socketToUser.set(socket.id, userId);

    console.log(
      `[SessionService] New session created for user ${userName} (${userId}) on socket ${socket.id}`,
    );
    console.log(
      `[SessionService] Active sessions: ${this.activeSessions.size}`,
    );
  }

  addSocketToSession(
    userId: string,
    userName: string,
    socket: Socket,
  ): void {
    console.log(`[SessionService] Adding socket ${socket.id} to session for user ${userName} (${userId})`);
    
    const existingSession = this.activeSessions.get(userId);
    if (existingSession) {
      // Добавляем сокет к существующей сессии
      existingSession.sockets.set(socket.id, socket);
      this.socketToUser.set(socket.id, userId);
      console.log(
        `[SessionService] Added socket ${socket.id} to existing session for user ${userName}, now has ${existingSession.sockets.size} sockets`,
      );
    } else {
      // Создаем новую сессию если её нет (возможно при первом подключении не к /users)
      console.log(`[SessionService] No existing session found for user ${userName}, creating new session`);
      const newSession: ActiveSession = {
        userId,
        userName,
        sockets: new Map([[socket.id, socket]]),
        timestamp: Date.now(),
      };

      this.activeSessions.set(userId, newSession);
      this.socketToUser.set(socket.id, userId);
      console.log(
        `[SessionService] New session created for user ${userName} (${userId}) on socket ${socket.id}`,
      );
    }
  }

  removeSession(socketId: string): void {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return;

    const session = this.activeSessions.get(userId);
    if (session) {
      // Удаляем только конкретный сокет
      session.sockets.delete(socketId);

      // Если больше нет сокетов - НЕ удаляем сессию сразу, а ставим таймер
      if (session.sockets.size === 0) {
        console.log(
          `[SessionService] User ${session.userName} has no active sockets, setting removal timer...`,
        );
        
        // Даем 30 секунд на переподключение
        setTimeout(() => {
          const currentSession = this.activeSessions.get(userId);
          // Проверяем что сессия все еще пуста и не изменилась
          if (currentSession && currentSession === session && currentSession.sockets.size === 0) {
            this.activeSessions.delete(userId);
            console.log(
              `[SessionService] Removed session for user ${session.userName} after timeout`,
            );
          } else {
            console.log(
              `[SessionService] Session for user ${session.userName} was restored, keeping it`,
            );
          }
        }, 30000); // 30 секунд
      } else {
        console.log(
          `[SessionService] Removed socket ${socketId}, user ${session.userName} still has ${session.sockets.size} active sockets`,
        );
      }
    }

    this.socketToUser.delete(socketId);
  }

  disconnectUser(userId: string, reason: string): void {
    const session = this.activeSessions.get(userId);
    if (session) {
      console.log(
        `[SessionService] Disconnecting user ${session.userName} (${userId}) with reason: ${reason}`,
      );

      // Отключаем все сокеты пользователя
      for (const [socketId, socket] of session.sockets) {
        socket.emit('forcedLogout', {
          reason,
          timestamp: new Date().toISOString(),
        });
        socket.disconnect(true);
        this.socketToUser.delete(socketId);
      }

      this.activeSessions.delete(userId);
    }
  }

  // Новый метод для отключения конкретной сессии
  disconnectSession(session: ActiveSession, reason: string): void {
    console.log(
      `[SessionService] Disconnecting session for user ${session.userName} (${session.userId}) with reason: ${reason}`,
    );

    // Отключаем все сокеты переданной сессии
    for (const [socketId, socket] of session.sockets) {
      socket.emit('forcedLogout', {
        reason,
        timestamp: new Date().toISOString(),
      });
      socket.disconnect(true);
      
      // Удаляем сокет из карты socketToUser
      this.socketToUser.delete(socketId);
    }

    // НЕ удаляем активную сессию, так как новая уже зарегистрирована
    // Просто очищаем старые сокеты
    console.log(
      `[SessionService] Disconnected ${session.sockets.size} sockets for user ${session.userName}`,
    );
  }

  isActiveSession(userId: string, socketId: string): boolean {
    const session = this.activeSessions.get(userId);
    return session ? session.sockets.has(socketId) : false;
  }

  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }
}
