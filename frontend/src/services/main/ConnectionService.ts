import { logger } from "../../utils/Logger";
import type SocketStore from "../stores/SocketStore";

/*
  ConnectionService - сервис для мониторинга состояния соединений с сокетами
  и автоматического восстановления при отключениях.
*/
interface ConnectionStats {
  users: boolean;
  posts: boolean;
  comments: boolean;
  search: boolean;
  lastCheck: number;
}

/*
  Сервис для мониторинга состояния соединений с сокетами.
  - Проверяет состояние соединений каждые 30 секунд
  - Автоматически восстанавливает соединения при отключении
  - Логирует состояние соединений
*/
class ConnectionService {
  private intervalId: NodeJS.Timeout | null = null;
  private socketStore: SocketStore | null = null;
  private lastStats: ConnectionStats | null = null;
  private readonly CHECK_INTERVAL = 30000;
  private readonly RECONNECT_DELAY = 5000;

  init(socketStore: SocketStore) {
    if (this.socketStore) {
      return;
    }
    
    this.socketStore = socketStore;
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
    posts: this.socketStore.posts?.connected === true,
    comments: this.socketStore.comments?.connected === true,
    search: this.socketStore.search?.connected === true,
    lastCheck: Date.now()
  };

  // Логируем результаты только для отладки
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
  // И ТОЛЬКО если они должны быть подключены (проверяем что сокеты вообще существуют)
  if (isAuthenticated) {
    if (!stats.posts && this.socketStore.posts) disconnectedSockets.push('posts');
    if (!stats.comments && this.socketStore.comments) disconnectedSockets.push('comments');
    if (!stats.search && this.socketStore.search) disconnectedSockets.push('search');
  }

  // Выводим предупреждение ТОЛЬКО если действительно есть проблемы
  if (disconnectedSockets.length > 0) {
    if (isAuthenticated && disconnectedSockets.length > 1) {
      // Для авторизованных - показываем только если отключено больше одного сокета
      logger.warn(`[ConnectionService] Detected disconnected sockets: ${disconnectedSockets.join(', ')}`);
      
      // Планируем попытку восстановления только для критичных случаев
      setTimeout(() => {
        this.attemptReconnection(disconnectedSockets);
      }, this.RECONNECT_DELAY);
    } else if (!isAuthenticated && disconnectedSockets.includes('users')) {
      // Для неавторизованных - только если отключен users сокет
      logger.warn(`[ConnectionService] Users socket disconnected`);
      
      setTimeout(() => {
        this.attemptReconnection(['users']);
      }, this.RECONNECT_DELAY);
    }
  }
}

private attemptReconnection(disconnectedSockets: string[]) {
  if (!this.socketStore) return;

  // Проверяем, что проблема все еще актуальна
  const currentStats = this.checkConnections();
  const stillDisconnected = disconnectedSockets.filter(socketName => {
    switch (socketName) {
      case 'users': return !currentStats.users;
      case 'posts': return !currentStats.posts;
      case 'comments': return !currentStats.comments;
      case 'search': return !currentStats.search;
      default: return false;
    }
  });

  if (stillDisconnected.length === 0) {
    logger.log(`[ConnectionService] Sockets reconnected automatically, skipping manual reconnection`);
    return;
  }

  logger.log(`[ConnectionService] Attempting to reconnect: ${stillDisconnected.join(', ')}`);

  const isAuthenticated = this.socketStore.isUserAuthenticated();
  const authStore = this.socketStore.authStore;

  stillDisconnected.forEach(socketName => {
    try {
      switch (socketName) {
        case 'users':
          this.socketStore!.reconnectUsersSocket();
          break;
        case 'posts':
        case 'comments':  
        case 'search':
          // Для аутентифицированных сокетов - переинициализируем все сразу
          if (isAuthenticated && authStore.token) {
            logger.log(`[ConnectionService] Reinitializing all authenticated sockets`);
            this.socketStore!.initializeAuthenticatedSockets(authStore.token);
            return; // Выходим, чтобы не инициализировать каждый сокет отдельно
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