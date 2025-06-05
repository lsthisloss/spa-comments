import { logger } from "../utils/Logger";
import type SocketStore from "./stores/SocketStore";

interface ConnectionStats {
  users: boolean;
  posts: boolean;
  comments: boolean;
  search: boolean;
  lastCheck: number;
}

class ConnectionService {
  private intervalId: NodeJS.Timeout | null = null;
  private socketStore: SocketStore | null = null;
  private lastStats: ConnectionStats | null = null;
  private readonly CHECK_INTERVAL = 30000; // 30 seconds
  private readonly RECONNECT_DELAY = 5000; // 5 seconds

  init(socketStore: SocketStore) {
    if (this.socketStore) {
      logger.debug('[ConnectionService] Already initialized, skipping');
      return;
    }
    
    this.socketStore = socketStore;
    logger.log('[ConnectionService] Starting connection monitoring');
    
    // Initial check (silent)
    this.performSilentCheck();
    
    // Start monitoring interval
    this.intervalId = setInterval(() => {
      this.performSilentCheck();
    }, this.CHECK_INTERVAL);
  }


  private hasStatusChanged(current: ConnectionStats): boolean {
    if (!this.lastStats) return true;

    return (
      this.lastStats.users !== current.users ||
      this.lastStats.posts !== current.posts ||
      this.lastStats.comments !== current.comments ||
      this.lastStats.search !== current.search
    );
  }

private checkConnections(): ConnectionStats {
  if (!this.socketStore) {
    return { users: false, posts: false, comments: false, search: false, lastCheck: Date.now() };
  }

  // Получаем статус авторизации
  const isAuthenticated = this.socketStore.isUserAuthenticated();
  
  // Базовая проверка сокетов
  const stats = {
    users: this.socketStore.users?.connected === true,
    posts: isAuthenticated ? this.socketStore.posts?.connected === true : true, // Для неавторизованных всегда true
    comments: isAuthenticated ? this.socketStore.comments?.connected === true : true,
    search: isAuthenticated ? this.socketStore.search?.connected === true : true,
    lastCheck: Date.now()
  };

  // Логируем результаты
  if (isAuthenticated) {
    logger.log(`[ConnectionService] Connection status (auth): ${JSON.stringify(stats)}`);
  } else {
    logger.log(`[ConnectionService] Connection status (unauth): {users: ${stats.users}}`);
  }

  return stats;
}

private handleDisconnections(stats: ConnectionStats) {
  if (!this.socketStore) return;

  // Получаем статус авторизации
  const isAuthenticated = this.socketStore.isUserAuthenticated();
  
  const disconnectedSockets: string[] = [];

  // Всегда проверяем users сокет
  if (!stats.users) disconnectedSockets.push('users');
  
  // Остальные сокеты проверяем ТОЛЬКО для авторизованных пользователей
  if (isAuthenticated) {
    if (!stats.posts) disconnectedSockets.push('posts');
    if (!stats.comments) disconnectedSockets.push('comments');
    if (!stats.search) disconnectedSockets.push('search');
  }

  if (disconnectedSockets.length > 0) {
    // Не выводим предупреждение для неавторизованных пользователей о сокетах, которые им не нужны
    if (isAuthenticated || disconnectedSockets.includes('users')) {
      logger.warn(`[ConnectionService] Detected disconnected sockets: ${disconnectedSockets.join(', ')}`);
    }
    
    // Планируем попытку восстановления
    setTimeout(() => {
      this.attemptReconnection(disconnectedSockets);
    }, this.RECONNECT_DELAY);
  }
}

  private attemptReconnection(disconnectedSockets: string[]) {
    if (!this.socketStore) return;

    logger.log(`[ConnectionService] Attempting to reconnect: ${disconnectedSockets.join(', ')}`);

    // Only reconnect specific sockets that are disconnected
    disconnectedSockets.forEach(socketName => {
      try {
        switch (socketName) {
          case 'users':
            this.socketStore!.reconnectUsersSocket();
            break;
          case 'posts':
            if (this.socketStore!.posts && !this.socketStore!.posts.connected) {
              this.socketStore!.posts.connect();
            }
            break;
          case 'comments':
            if (this.socketStore!.comments && !this.socketStore!.comments.connected) {
              this.socketStore!.comments.connect();
            }
            break;
          case 'search':
            if (this.socketStore!.search && !this.socketStore!.search.connected) {
              this.socketStore!.search.connect();
            }
            break;
        }
      } catch (error) {
        logger.error(`[ConnectionService] Failed to reconnect ${socketName}:`, error);
      }
    });
  }

private performSilentCheck() {
  if (!this.socketStore) return;

  // Используем checkConnections вместо прямого создания объекта
  const currentStats = this.checkConnections();

  // Логируем только при изменении статуса
  if (this.hasStatusChanged(currentStats)) {
    // checkConnections уже включает логирование, дополнительное не нужно
    
    // Проверяем отключения и запускаем восстановление при необходимости
    this.handleDisconnections(currentStats);
  }

  this.lastStats = currentStats;
}

// Также обновим checkHealth для использования checkConnections
checkHealth(): ConnectionStats | null {
  if (!this.socketStore) return null;
  return this.checkConnections();
}

  // Get connection summary for debugging
  getConnectionSummary(): string {
    const stats = this.checkHealth();
    if (!stats) return 'ConnectionService not initialized';

    const connected = Object.entries(stats)
      .filter(([key, value]) => key !== 'lastCheck' && value === true)
      .map(([key]) => key);

    const disconnected = Object.entries(stats)
      .filter(([key, value]) => key !== 'lastCheck' && value === false)
      .map(([key]) => key);

    return `Connected: ${connected.join(', ') || 'none'}, Disconnected: ${disconnected.join(', ') || 'none'}`;
  }

  // Force reconnection of all sockets
  forceReconnectAll() {
    if (!this.socketStore) {
      logger.warn('[ConnectionService] Cannot reconnect - not initialized');
      return;
    }

    logger.log('[ConnectionService] Force reconnecting all sockets');
    
    try {
      this.socketStore.disconnectAllSockets();
      
      // Wait a bit before reconnecting
      setTimeout(() => {
        this.socketStore!.reconnectUsersSocket();
        // Authenticated sockets will be handled by SocketStore if needed
      }, 1000);
    } catch (error) {
      logger.error('[ConnectionService] Error during force reconnect:', error);
    }
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.log('[ConnectionService] Connection monitoring stopped');
    }
    
    this.socketStore = null;
    this.lastStats = null;
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  restart(socketStore: SocketStore) {
    logger.log('[ConnectionService] Restarting connection service');
    this.destroy();
    this.init(socketStore);
  }
}

export const connectionService = new ConnectionService();