import { makeObservable, observable, action, runInAction } from "mobx";
import io from "socket.io-client";
import { logger } from "../../utils/Logger";
import { notification } from 'antd';
import AuthStore from "./AuthStore";
import UserStore from "./UserStore";
import { ISocketStore } from "../../types/stores";
import { testService } from "../test/TestService";
/**
 * SocketStore - управляет всеми веб-сокет соединениями приложения
 * - Инициализирует и поддерживает сокеты для users, posts, comments и search
 * - Обрабатывает подключение, отключение и ошибки для всех сокетов
 * - Поддерживает аутентифицированные и неаутентифицированные соединения
 * - Реализует механизм защиты от множественного входа в аккаунт
 * - Использует MobX для управления состоянием
 */
class SocketStore implements ISocketStore {
  // Основные сокеты
  users: ReturnType<typeof io> | null = null;
  posts: ReturnType<typeof io> | null = null;
  comments: ReturnType<typeof io> | null = null;
  search: ReturnType<typeof io> | null = null;
  
  // Состояние соединений
  connected = false;
  postsReady = false;
  commentsReady = false;
  isReconnecting = false;
  
  // Внутренние состояния
  private currentToken: string | null = null;
  private initializationInProgress = false;
  
  // Инъектированные сторы
  private authStore: AuthStore;
  private userStore: UserStore;

  constructor(authStore: AuthStore, userStore: UserStore) {
    this.authStore = authStore;
    this.userStore = userStore;
    
    makeObservable(this, {
      users: observable,
      posts: observable,
      comments: observable,
      search: observable,
      connected: observable,
      postsReady: observable,
      commentsReady: observable,
      isReconnecting: observable,
      initializeAuthenticatedSockets: action,
      disconnectAuthenticatedSockets: action,
      disconnectAllSockets: action,
      reconnectUsersSocket: action,
      checkConnections: action,
      setPosts: action,
      setComments: action,
      setSearch: action,
      setUsers: action,
      setConnected: action,
      setPostsReady: action,
      setCommentsReady: action,
      checkSocketsReady: action,
    });

    // Инициализируем сокет users сразу (без токена)
    this.initializeUsersSocket();
  }

  // ---------------------------------------------------
  // Методы для установки состояний (actions)
  // ---------------------------------------------------

  setUsers = action((socket: ReturnType<typeof io> | null) => {
    this.users = socket;
  })

  setPosts = action((socket: ReturnType<typeof io> | null) => {
    this.posts = socket;
  })

  setComments = action((socket: ReturnType<typeof io> | null) => {
    this.comments = socket;
  })

  setSearch = action((socket: ReturnType<typeof io> | null) => {
    this.search = socket;
  })

  setConnected = action((connected: boolean) => {
    this.connected = connected;
  })

  setPostsReady = action((ready: boolean) => {
    this.postsReady = ready;
  })

  setCommentsReady = action((ready: boolean) => {
    this.commentsReady = ready;
  })

  // ---------------------------------------------------
  // Публичные методы для внешнего использования
  // ---------------------------------------------------

  initializeAuthenticatedSockets = action(async (token: string): Promise<void> => {
    if (this.initializationInProgress) {
      logger.log("[SocketStore] Socket initialization already in progress, waiting...");
      return this.waitForInitialization();
    }

    if (this.hasTokenConnection(token)) {
      return;
    }

    this.initializationInProgress = true;
    
    try {
      this.currentToken = token;
      const wsUrl = import.meta.env.VITE_WS_URL;
      
      // Всегда используем обычный режим
      const socketConfig: Record<string, unknown> = {
        transports: ['websocket', 'polling'] as ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        auth: {
          token: token
        },
        extraHeaders: {
          'Authorization': `Bearer ${token}`
        }
      };

      // Отключаем старые соединения
      await this.cleanupSockets();

      // Инициализируем все сокеты с одинаковой конфигурацией
      const usersSocket = io(`${wsUrl}/users`, socketConfig);
      this.setUsers(usersSocket);
      this.setupUsersHandlers();

      const postsSocket = io(`${wsUrl}/posts`, socketConfig);
      this.setPosts(postsSocket);
      this.setupPostsHandlers();

      const commentsSocket = io(`${wsUrl}/comments`, socketConfig);
      this.setComments(commentsSocket);
      this.setupCommentsHandlers();

      const searchSocket = io(`${wsUrl}/search`, socketConfig);
      this.setSearch(searchSocket);
      this.setupSearchHandlers();

      // Ждем подключения
      const connections = await Promise.allSettled([
        this.waitForConnection(this.users!, 'users', 3000),
        this.waitForConnection(this.posts!, 'posts', 3000),
        this.waitForConnection(this.comments!, 'comments', 3000),
        this.waitForConnection(this.search!, 'search', 3000),
      ]);

      // Проверяем результаты
      const failed = connections.filter(result => result.status === 'rejected');
      if (failed.length > 0) {
        logger.warn(`[SocketStore] Some sockets failed to connect: ${failed.length}/${connections.length}`);
        failed.forEach((failure, index) => {
          const socketNames = ['users', 'posts', 'comments', 'search'];
          logger.error(`${socketNames[index]} socket failed:`, (failure as PromiseRejectedResult).reason);
        });
      } else {
        logger.log(`[SocketStore] All authenticated sockets initialized successfully`);
      }

    } catch (error) {
      logger.error("[SocketStore] Failed to initialize authenticated sockets:", error);
      throw error;
    } finally {
      this.initializationInProgress = false;
    }
  })

  /**
   * Проверяет готовность всех сокетов и отправляет событие
   */
  checkSocketsReady = action(() => {
    if (this.posts?.connected && 
        this.comments?.connected && 
        this.users?.connected &&
        this.search?.connected) {
      
      logger.log(`[SocketStore] All sockets ready, dispatching event`);
      
      // Отправляем событие о готовности всех сокетов
      const event = new CustomEvent('sockets-ready');
      document.dispatchEvent(event);
    }
  })

  /**
   * Отключает все аутентифицированные сокеты
   */
  disconnectAuthenticatedSockets = action(() => {
    logger.log("[SocketStore] Disconnecting authenticated sockets");
    
    this.currentToken = null;
    
    if (this.posts) {
      this.posts.disconnect();
      this.setPosts(null);
    }
    
    if (this.comments) {
      this.comments.disconnect();
      this.setComments(null);
    }

    if (this.search) {
      this.search.disconnect();
      this.setSearch(null);
    }

    this.setPostsReady(false);
    this.setCommentsReady(false);

    // Переинициализируем users socket без токена
    this.initializeUsersSocket();
  })

  /**
   * Отключает все сокеты, включая неаутентифицированные
   */
  disconnectAllSockets = action(() => {
    logger.info('[SocketStore] Disconnecting all sockets');
    
    const socketsToDisconnect = [
      { socket: this.users, name: 'Users' },
      { socket: this.posts, name: 'Posts' },
      { socket: this.comments, name: 'Comments' },
      { socket: this.search, name: 'Search' }
    ];
    
    for (const { socket, name } of socketsToDisconnect) {
      if (socket && socket.connected) {
        socket.disconnect();
        logger.log(`[SocketStore] ${name} socket disconnected`);
      }
    }
    
    // Сбрасываем все состояния
    this.setUsers(null);
    this.setPosts(null);
    this.setComments(null);
    this.setSearch(null);
    this.setConnected(false);
    this.setPostsReady(false);
    this.setCommentsReady(false);
  })

  /**
   * Переподключает только сокет пользователей
   */
  reconnectUsersSocket = action(() => {
    logger.info('[SocketStore] Reconnecting users socket only');
    
    if (this.users) {
      this.users.disconnect();
      this.setUsers(null);
    }
    
    // Инициализируем сокет пользователей
    this.initializeUsersSocket();
  })

  /**
   * Проверяет все соединения и восстанавливает при необходимости
   */
  checkConnections = action(() => {
    logger.log('[SocketStore] Checking socket connections');
    
    // Проверка сокета пользователей
    if (!this.users || !this.users.connected) {
      logger.log('[SocketStore] Users socket not connected, reconnecting...');
      this.reconnectUsersSocket();
      return;
    }
    
    // Проверка сокетов с аутентификацией
    if (this.authStore.isAuthenticated && this.authStore.token) {
      if (!this.posts?.connected || !this.comments?.connected || !this.search?.connected) {
        logger.log('[SocketStore] Authenticated sockets not properly connected, reconnecting...');
        this.initializeAuthenticatedSockets(this.authStore.token).catch(err => {
          logger.error('[SocketStore] Failed to reconnect authenticated sockets:', err);
        });
      }
    }
  })


  /**
   * Проверяет, установлено ли соединение с указанным токеном
   */
  hasTokenConnection(token: string): boolean {
    return this.currentToken === token && 
           this.posts?.connected === true && 
           this.comments?.connected === true &&
           this.users?.connected === true;
  }

  /**
   * Ожидает подключения сокета постов
   */
  async waitForPostsSocket(timeoutMs = 5000): Promise<boolean> {
    if (this.posts?.connected) return true;
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), timeoutMs);
      
      if (this.posts) {
        this.posts.once('connect', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      } else {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  /**
   * Ожидает подключения сокета комментариев
   */
  async waitForCommentsSocket(timeoutMs = 5000): Promise<boolean> {
    if (this.comments?.connected) return true;
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), timeoutMs);
      
      if (this.comments) {
        this.comments.once('connect', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      } else {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  /**
   * Проверяет, готов ли указанный сокет
   */
  isSocketReady(socket: ReturnType<typeof io> | null): boolean {
    return socket?.connected || false;
  }

  /**
   * Проверяет, готов ли сокет постов
   */
  isPostsSocketReady(): boolean {
    return this.isSocketReady(this.posts);
  }

  /**
   * Проверяет, готов ли сокет комментариев
   */
  isCommentsSocketReady(): boolean {
    return this.isSocketReady(this.comments);
  }

  /**
   * Проверяет, подключен ли сокет указанного типа
   */
  isSocketConnected(type: 'posts' | 'comments' | 'users' | 'search'): boolean {
    const socket = this[type];
    return !!socket && socket.connected;
  }

  // ---------------------------------------------------
  // Приватные методы и вспомогательные функции
  // ---------------------------------------------------

  private initializeUsersSocket() {
    if (this.users?.connected) return;

    const wsUrl = import.meta.env.VITE_WS_URL;
    
    let socketConfig: Record<string, unknown> = {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    };

    // ПРОВЕРЯЕМ ТЕСТОВЫЙ РЕЖИМ
    if (testService.isTestMode()) {
      logger.log("[SocketStore] Initializing users socket in TEST mode");
      
      const testQueryParams = testService.getTestQueryParams();
      socketConfig = {
        ...socketConfig,
        query: testQueryParams,
        forceNew: true,
        reconnection: false, // Отключаем реконнект для тестов
      };
      
      logger.log("[SocketStore] Test users socket config:", socketConfig);
    } else {
      logger.log("[SocketStore] Initializing users socket (no auth required)");
    }
    
    const userSocket = io(`${wsUrl}/users`, socketConfig);

    runInAction(() => {
      this.setUsers(userSocket);
    });

    this.setupUsersHandlers();
  }

  /**
   * Настраивает обработчики событий для сокета пользователей
   */
  private setupUsersHandlers() {
    if (!this.users) return;

    this.users.on('connect', () => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.log(`[SocketStore] Users socket connected${mode}`);
      
      runInAction(() => {
        this.setConnected(true);
        this.checkSocketsReady();
      });
    });

    this.users.on('forcedLogout', (data: { reason: string, timestamp: string }) => {
      // В тестовом режиме можем логировать по-другому
      if (testService.isTestMode()) {
        logger.log("[SocketStore] Test mode: ignoring forcedLogout", data);
        return;
      }
      this.handleForcedLogout(data);
    });

    this.users.on('disconnect', () => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.log(`[SocketStore] Users socket disconnected${mode}`);
      
      runInAction(() => {
        this.setConnected(false);
      });
    });

    this.users.on('connect_error', (error: Error) => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.error(`[SocketStore] Users socket connection error${mode}:`, error);
    });
  }

  /**
   * Настраивает обработчики событий для сокета постов
   */
  private setupPostsHandlers() {
    if (!this.posts) return;

    this.posts.on('connect', () => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.log(`[SocketStore] Posts socket connected${mode}`);
      
      runInAction(() => {
        this.setPostsReady(true);
        this.checkSocketsReady(); 
      });
    });

    this.posts.on('forcedLogout', (data: { reason: string, timestamp: string }) => {
      if (testService.isTestMode()) {
        logger.log("[SocketStore] Test mode: ignoring forcedLogout", data);
        return;
      }
      this.handleForcedLogout(data);
    });

    this.posts.on('disconnect', () => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.log(`[SocketStore] Posts socket disconnected${mode}`);
      
      runInAction(() => {
        this.setPostsReady(false);
      });
    });

    this.posts.on('connect_error', (error: Error) => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.error(`[SocketStore] Posts socket connection error${mode}:`, error);
    });
  }

  /**
   * Настраивает обработчики событий для сокета комментариев
   */
  private setupCommentsHandlers() {
    if (!this.comments) return;

    this.comments.on('connect', () => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.log(`[SocketStore] Comments socket connected${mode}`);
      
      runInAction(() => {
        this.setCommentsReady(true);
        this.checkSocketsReady(); 
      });
    });

    this.comments.on('forcedLogout', (data: { reason: string, timestamp: string }) => {
      if (testService.isTestMode()) {
        logger.log("[SocketStore] Test mode: ignoring forcedLogout", data);
        return;
      }
      this.handleForcedLogout(data);
    });

    this.comments.on('disconnect', () => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.log(`[SocketStore] Comments socket disconnected${mode}`);
      
      runInAction(() => {
        this.setCommentsReady(false);
      });
    });

    this.comments.on('connect_error', (error: Error) => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.error(`[SocketStore] Comments socket connection error${mode}:`, error);
    });
  }

  /**
   * Настраивает обработчики событий для сокета поиска
   */
  private setupSearchHandlers() {
    if (!this.search) return;
    
    this.search.on('connect', () => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.log(`[SocketStore] Search socket connected${mode}`);
      this.checkSocketsReady();
    });
    
    this.search.on('forcedLogout', (data: { reason: string, timestamp: string }) => {
      if (testService.isTestMode()) {
        logger.log("[SocketStore] Test mode: ignoring forcedLogout", data);
        return;
      }
      this.handleForcedLogout(data);
    });
    
    this.search.on('disconnect', () => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.log(`[SocketStore] Search socket disconnected${mode}`);
    });
    
    this.search.on('connect_error', (error: Error) => {
      const mode = testService.isTestMode() ? " (TEST MODE)" : "";
      logger.error(`[SocketStore] Search socket connection error${mode}:`, error);
    });
  }

  /**
   * Обрабатывает событие принудительного выхода
   */
handleForcedLogout = action((data: { reason: string; timestamp: string }) => {
  logger.warn("[SocketStore] Forced logout received:", data);
  
  // Clear auth data
  this.authStore.clearAuthData();
  
  // Safely clear user if the method exists
  if (this.userStore && typeof this.userStore.clearUser === 'function') {
    this.userStore.clearUser();
  } else {
    // Fallback if method doesn't exist
    if (this.userStore) {
      runInAction(() => {
        this.userStore.user = null;
      });
      try {
        localStorage.removeItem('user');
      } catch (e) {
        logger.error('[SocketStore] Failed to remove user from localStorage', e);
      }
      logger.log('[SocketStore] User cleared (fallback method)');
    }
  }
    notification.error({
      message: 'Вы были отключены',
      description: data.reason,
      duration: 0,
    });
  // Disconnect all sockets
  this.disconnectAllSockets();
  
});
  /**
   * Очищает все сокеты, отключая их
   */
  private async cleanupSockets(): Promise<void> {
    const socketsToCleanup = [this.users, this.posts, this.comments, this.search];
    
    for (const socket of socketsToCleanup) {
      if (socket?.connected) {
        socket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Ожидает завершения инициализации сокетов
   */
  private async waitForInitialization(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.initializationInProgress) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 10000);
    });
  }

  /**
   * Ожидает подключения сокета с таймаутом
   */
  private waitForConnection(socket: ReturnType<typeof io>, name: string, timeoutMs = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (socket.connected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`${name} socket connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      socket.once('connect_error', (error: Error) => {
        clearTimeout(timeout);
        reject(new Error(`${name} socket connection error: ${error.message}`));
      });
    });
  }
}

export default SocketStore;