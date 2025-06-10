import { makeObservable, observable, action, runInAction } from "mobx";
import io from "socket.io-client";
import { logger } from "../../utils/Logger";
import { notification } from 'antd';
import AuthStore from "./AuthStore";
import UserStore from "./UserStore";
import { ISocketStore } from "../../types/stores";
import { testService } from "../test/TestService";
import { createAuthenticatedSocket, createPublicSocket } from "../main/websocket";
import { connectionService } from "../main/ConnectionService";

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
  private usersInitialized = false;

  // Инъектированные сторы
  public authStore: AuthStore;
  private userStore: UserStore;

  constructor(authStore: AuthStore, userStore: UserStore) {
    // Получаем зависимости
    this.authStore = authStore;
    this.userStore = userStore;


    makeObservable(this, {
      // Обсервируемые свойства
      users: observable,
      posts: observable,
      comments: observable,
      search: observable,
      connected: observable,
      postsReady: observable,
      commentsReady: observable,
      isReconnecting: observable,

      // Экшн методы для управления состоянием
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
      reset: action,
    });

    logger.log("[SocketStore] SocketStore created, waiting for explicit initialization");
  }

  /*
   Методы для проверки состояния сокетов и пользователя (экшены)
  */
  isUserAuthenticated(): boolean {
    return this.authStore.isAuthenticated;
  }

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

  //
  reset = action(async () => {
    logger.info('[SocketStore] Resetting SocketStore state');

    this.initializationInProgress = false;
    this.currentToken = null;
    this.usersInitialized = false;

    // Отключаем все сокеты
    await this.cleanupSockets();

    // Сбрасываем состояния
    this.setUsers(null);
    this.setPosts(null);
    this.setComments(null);
    this.setSearch(null);
    this.setConnected(false);
    this.setPostsReady(false);
    this.setCommentsReady(false);
    this.isReconnecting = false;
  })

  /**
   * Инициализирует базовые сокеты (только users)
   * Используется для инициализации без аутентификации
   */
  initializeBasicSockets = action(async () => {
    if (this.usersInitialized) {
      logger.log("[SocketStore] Users socket already initialized");
      return;
    }

    logger.log("[SocketStore] Initializing basic sockets (users only)");

    // Remove health check here - initialization should proceed regardless
    this.initializeUsersSocket();
    this.usersInitialized = true;
  })

  /*
    * Инициализирует аутентифицированные сокеты
    * Создает и настраивает сокеты для posts, comments, search с токеном
    * Если уже есть соединение с таким токеном - не переинициализируем
  */
  initializeAuthenticatedSockets = action(async (token: string): Promise<void> => {
    // Если уже есть соединение с таким токеном - не переинициализируем
    if (this.hasTokenConnection(token)) {
      logger.log("[SocketStore] Authenticated sockets already initialized with this token");
      return;
    }

    if (this.initializationInProgress) {
      logger.log("[SocketStore] Socket initialization already in progress, waiting...");
      return this.waitForInitialization();
    }

    this.initializationInProgress = true;

    try {
      this.currentToken = token;

      // Отключаем старые аутентифицированные соединения
      await this.cleanupAuthenticatedSockets();

      // Создаем новый users сокет с токеном (заменяем существующий)
      if (this.users) {
        this.users.disconnect();
      }

      const usersSocket = createAuthenticatedSocket('/users', token);
      if (usersSocket) {
        this.setUsers(usersSocket);
        this.setupUsersHandlers();
      }

      // Создаем остальные аутентифицированные сокеты
      const postsSocket = createAuthenticatedSocket('/posts', token);
      if (postsSocket) {
        this.setPosts(postsSocket);
        this.setupPostsHandlers();
      }

      const commentsSocket = createAuthenticatedSocket('/comments', token);
      if (commentsSocket) {
        this.setComments(commentsSocket);
        this.setupCommentsHandlers();
      }

      const searchSocket = createAuthenticatedSocket('/search', token);
      if (searchSocket) {
        this.setSearch(searchSocket);
        this.setupSearchHandlers();
      }

      // Ждем подключения всех сокетов
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
        // Даже если какие-то сокеты не подключились, запускаем мониторинг
      } else {
        logger.log(`[SocketStore] All authenticated sockets initialized successfully`);
      }

      // Запускаем ConnectionService ТОЛЬКО после завершения инициализации
      // и ТОЛЬКО если он еще не запущен
      if (!connectionService.isRunning()) {
        // Небольшая задержка, чтобы все обработчики успели настроиться
        setTimeout(() => {
          connectionService.init(this);
          logger.log("[SocketStore] Connection monitoring started after auth sockets initialization");
        }, 500);
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

    // Переинициализируем users socket без токена ТОЛЬКО если его нет
    if (!this.users || !this.users.connected) {
      this.initializeUsersSocket();
    }
  })

  /**
   * Отключает все сокеты, включая неаутентифицированные
   */
  disconnectAllSockets = action(async () => {
    logger.info('[SocketStore] Disconnecting all sockets');

    // Используем cleanupSockets для отключения всех сокетов
    await this.cleanupSockets();

    // Сбрасываем все состояния
    this.setUsers(null);
    this.setPosts(null);
    this.setComments(null);
    this.setSearch(null);
    this.setConnected(false);
    this.setPostsReady(false);
    this.setCommentsReady(false);
    this.usersInitialized = false; // Сбрасываем флаг
  })

  /**
   * Переподключает только сокет пользователей
   */
  reconnectUsersSocket = action(async () => {
    logger.info('[SocketStore] Reconnecting users socket using centralized websocket function');

    if (this.users) {
      // Отключаем только если соединение активно
      if (this.users.connected) {
        this.users.disconnect();
        // Небольшая задержка для корректного отключения
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      this.setUsers(null);
    }

    try {
      // Используем централизованную функцию
      const userSocket = createPublicSocket('/users');

      if (userSocket) {
        logger.log(`[SocketStore] Users socket created successfully`);

        runInAction(() => {
          this.setUsers(userSocket);
        });

        this.setupUsersHandlers();
        this.usersInitialized = true;

        return userSocket;
      } else {
        logger.error("[SocketStore] Failed to create users socket using centralized function");
        return null;
      }
    } catch (error) {
      logger.error("[SocketStore] Error reconnecting users socket:", error);
      return null;
    }
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
        logger.log('[SocketStore] Some authenticated sockets disconnected, reinitializing...');
        this.initializeAuthenticatedSockets(this.authStore.token);
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
      this.users?.connected === true &&
      this.search?.connected === true;
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

  /**
   * Настраивает обработчики событий для сокета пользователей
   */
  private setupUsersHandlers() {
    if (!this.users) return;

    this.users.on('connect', () => {
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
   * Инициализирует сокет пользователей, если он еще не создан
   */
  private initializeUsersSocket() {
    if (this.users?.connected) return;

    try {
      // Используем централизованную функцию для создания публичного сокета
      const userSocket = createPublicSocket('/users');

      if (userSocket) {
        logger.log(`[SocketStore] Users socket created successfully`);

        runInAction(() => {
          this.setUsers(userSocket);
        });

        this.setupUsersHandlers();

        return userSocket;
      } else {
        logger.error("[SocketStore] Failed to create users socket using centralized function");
        return null;
      }
    } catch (error) {
      logger.error("[SocketStore] Failed to create users socket:", error);
      return null;
    }
  }

  /**
   * Очищает только аутентифицированные сокеты
   */
  private async cleanupAuthenticatedSockets(): Promise<void> {
    const socketsToCleanup = [this.posts, this.comments, this.search];

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
        reject(new Error(`${name} socket connection timeout`));
      }, timeoutMs);

      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      socket.once('connect_error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  /**
   * Настраивает обработчики событий для сокета постов
   */
  private setupPostsHandlers() {
    if (!this.posts) return;

    this.posts.on('connect', () => {
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
  handleForcedLogout = action(async (data: { reason: string; timestamp: string }) => {
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

    await this.disconnectAllSockets();
  })
  /**
   * Очищает все сокеты, отключая их
   */
  private async cleanupSockets(): Promise<void> {
    logger.debug('[SocketStore] Cleaning up all socket connections');

    const socketsToCleanup = [
      { socket: this.users, name: 'users' },
      { socket: this.posts, name: 'posts' },
      { socket: this.comments, name: 'comments' },
      { socket: this.search, name: 'search' }
    ];

    for (const { socket, name } of socketsToCleanup) {
      if (socket?.connected) {
        logger.debug(`[SocketStore] Disconnecting ${name} socket`);
        socket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.debug('[SocketStore] All sockets cleaned up');
  }
}

export default SocketStore;