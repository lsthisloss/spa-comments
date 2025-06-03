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

  registerSession(
    userId: string,
    userName: string,
    socket: Socket,
  ): ActiveSession | null {
    const existingSession = this.activeSessions.get(userId);

    if (existingSession) {
      // Добавляем сокет к существующей сессии вместо её замены
      existingSession.sockets.set(socket.id, socket);
      this.socketToUser.set(socket.id, userId);

      console.log(
        `[SessionService] Added socket ${socket.id} to existing session for user ${userName}`,
      );
      console.log(
        `[SessionService] User ${userName} now has ${existingSession.sockets.size} active sockets`,
      );

      return null; // Не возвращаем предыдущую сессию для отключения
    }

    // Создаем новую сессию с первым сокетом
    const newSession: ActiveSession = {
      userId,
      userName,
      sockets: new Map([[socket.id, socket]]),
      timestamp: Date.now(),
    };

    this.activeSessions.set(userId, newSession);
    this.socketToUser.set(socket.id, userId);

    console.log(
      `[SessionService] User ${userName} (${userId}) logged in on socket ${socket.id}`,
    );
    console.log(
      `[SessionService] Active sessions: ${this.activeSessions.size}`,
    );

    return null;
  }

  removeSession(socketId: string): void {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return;

    const session = this.activeSessions.get(userId);
    if (session) {
      // Удаляем только конкретный сокет
      session.sockets.delete(socketId);

      // Если больше нет сокетов - удаляем сессию
      if (session.sockets.size === 0) {
        this.activeSessions.delete(userId);
        console.log(
          `[SessionService] Removed session for user ${session.userName}`,
        );
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

  isActiveSession(userId: string, socketId: string): boolean {
    const session = this.activeSessions.get(userId);
    return session ? session.sockets.has(socketId) : false;
  }

  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }
}
