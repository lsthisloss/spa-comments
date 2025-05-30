import { makeObservable, observable, action, runInAction } from "mobx";
import io from "socket.io-client";
import { logger } from "../../utils/Logger";
import authStore from "./AuthStore";

class SocketStore {
  users: ReturnType<typeof io> | null = null;
  posts: ReturnType<typeof io> | null = null;
  comments: ReturnType<typeof io> | null = null;
  connected = false;
  postsReady = false;
  commentsReady = false;
  isReconnecting = false;
  private currentToken: string | null = null;
  private initializationInProgress = false;

  constructor() {
    makeObservable(this, {
      users: observable,
      posts: observable,
      comments: observable,
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
      setUsers: action,
      setConnected: action,
      setPostsReady: action,
      setCommentsReady: action,
    });

    // Инициализируем сокет users сразу (без токена)
    this.initializeUsersSocket();
  }

  setUsers = action((socket: ReturnType<typeof io> | null) => {
    this.users = socket;
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

  setPosts = action((socket: ReturnType<typeof io> | null) => {
    this.posts = socket;
  })

  setComments = action((socket: ReturnType<typeof io> | null) => {
    this.comments = socket;
  })

  hasTokenConnection(token: string): boolean {
    return this.currentToken === token && 
           this.posts?.connected === true && 
           this.comments?.connected === true &&
           this.users?.connected === true;
  }

  private initializeUsersSocket() {
    if (this.users?.connected) return;

    logger.log("[SocketStore] Initializing users socket (no auth required)");
    
    const wsUrl = import.meta.env.VITE_WS_URL;
    
    const userSocket = io(`${wsUrl}/users`, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Используем action для установки сокета
    runInAction(() => {
      this.setUsers(userSocket);
    });

    this.users!.on('connect', () => {
      logger.log('[SocketStore] Users socket connected');
      runInAction(() => {
        this.setConnected(true);
      });
    });

    this.users!.on('disconnect', () => {
      logger.log('[SocketStore] Users socket disconnected');
      runInAction(() => {
        this.setConnected(false);
      });
    });

    this.users!.on('connect_error', (error: Error) => {
      logger.error('[SocketStore] Users socket connection error:', error);
    });
  }

  initializeAuthenticatedSockets = action(async (token: string): Promise<void> => {
    // Предотвращаем множественную инициализацию
    if (this.initializationInProgress) {
      logger.log("[SocketStore] Socket initialization already in progress, waiting...");
      return this.waitForInitialization();
    }

    // Проверяем, может уже инициализировано с этим токеном
    if (this.hasTokenConnection(token)) {
      return;
    }

    this.initializationInProgress = true;
    
    try {
      // Сохраняем текущий токен
      this.currentToken = token;
      
      const wsUrl = import.meta.env.VITE_WS_URL;
      
      // Создаем конфигурацию с токеном
      const socketConfig = {
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

      // Переинициализируем users socket с токеном для аутентификации
      const usersSocket = io(`${wsUrl}/users`, socketConfig);
      this.setUsers(usersSocket);
      this.setupUsersHandlers();

      // Инициализируем posts socket
      const postsSocket = io(`${wsUrl}/posts`, socketConfig);
      this.setPosts(postsSocket);
      this.setupPostsHandlers();

      // Инициализируем comments socket  
      const commentsSocket = io(`${wsUrl}/comments`, socketConfig);
      this.setComments(commentsSocket);
      this.setupCommentsHandlers();

      // Ждем подключения с более коротким таймаутом
      const connections = await Promise.allSettled([
        this.waitForConnection(this.users!, 'users', 3000),
        this.waitForConnection(this.posts!, 'posts', 3000),
        this.waitForConnection(this.comments!, 'comments', 3000)
      ]);

      // Проверяем результаты
      const failed = connections.filter(result => result.status === 'rejected');
      if (failed.length > 0) {
        logger.warn(`[SocketStore] Some sockets failed to connect: ${failed.length}/${connections.length}`);
        failed.forEach((failure, index) => {
          const socketNames = ['users', 'posts', 'comments'];
          logger.error(`${socketNames[index]} socket failed:`, (failure as PromiseRejectedResult).reason);
        });
      } else {
        logger.log("[SocketStore] All authenticated sockets initialized successfully");
      }

    } catch (error) {
      logger.error("[SocketStore] Failed to initialize authenticated sockets:", error);
      throw error;
    } finally {
      this.initializationInProgress = false;
    }
  })

  private async cleanupSockets(): Promise<void> {
    const socketsToCleanup = [this.users, this.posts, this.comments];
    
    for (const socket of socketsToCleanup) {
      if (socket?.connected) {
        socket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

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

  private setupUsersHandlers() {
    if (!this.users) return;

    this.users.on('connect', () => {
      logger.log('[SocketStore] Authenticated users socket connected');
      runInAction(() => {
        this.setConnected(true);
      });
    });

    this.users.on('disconnect', () => {
      logger.log('[SocketStore] Users socket disconnected');
      runInAction(() => {
        this.setConnected(false);
      });
    });

    this.users.on('connect_error', (error: Error) => {
      logger.error('[SocketStore] Users socket connection error:', error);
    });
  }

  private setupPostsHandlers() {
    if (!this.posts) return;

    this.posts.on('connect', () => {
      logger.log('[SocketStore] Posts socket connected');
      runInAction(() => {
        this.setPostsReady(true);
      });
    });

    this.posts.on('disconnect', () => {
      logger.log('[SocketStore] Posts socket disconnected');
      runInAction(() => {
        this.setPostsReady(false);
      });
    });

    this.posts.on('connect_error', (error: Error) => {
      logger.error('[SocketStore] Posts socket connection error:', error);
    });
  }

  private setupCommentsHandlers() {
    if (!this.comments) return;

    this.comments.on('connect', () => {
      logger.log('[SocketStore] Comments socket connected');
      runInAction(() => {
        this.setCommentsReady(true);
      });
    });

    this.comments.on('disconnect', () => {
      logger.log('[SocketStore] Comments socket disconnected');
      runInAction(() => {
        this.setCommentsReady(false);
      });
    });

    this.comments.on('connect_error', (error: Error) => {
      logger.error('[SocketStore] Comments socket connection error:', error);
    });
  }

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

    this.setPostsReady(false);
    this.setCommentsReady(false);

    // Переинициализируем users socket без токена
    this.initializeUsersSocket();
  })

  disconnectAllSockets = action(() => {
    logger.info('[SocketStore] Disconnecting all sockets');
    
    if (this.users && this.users.connected) {
      this.users.disconnect();
      logger.log('[SocketStore] Users socket disconnected');
    }
    
    if (this.posts && this.posts.connected) {
      this.posts.disconnect();
      logger.log('[SocketStore] Posts socket disconnected');
    }
    
    if (this.comments && this.comments.connected) {
      this.comments.disconnect();
      logger.log('[SocketStore] Comments socket disconnected');
    }
    
    // Используем actions для установки флагов
    this.setUsers(null);
    this.setPosts(null);
    this.setComments(null);
    this.setConnected(false);
    this.setPostsReady(false);
    this.setCommentsReady(false);
  })

  reconnectUsersSocket = action(() => {
    logger.info('[SocketStore] Reconnecting users socket only');
    
    if (this.users) {
      this.users.disconnect();
      this.setUsers(null);
    }
    
    // Инициализируем сокет пользователей
    this.initializeUsersSocket();
  })

  checkConnections = action(() => {
    logger.log('[SocketStore] Checking socket connections');
    
    // Проверка сокета пользователей
    if (!this.users || !this.users.connected) {
      logger.log('[SocketStore] Users socket not connected, reconnecting...');
      this.reconnectUsersSocket();
      return;
    }
    
    // Проверка сокетов с аутентификацией
    if (authStore.isAuthenticated && authStore.token) {
      if (!this.posts || !this.posts.connected || !this.comments || !this.comments.connected) {
        logger.log('[SocketStore] Authenticated sockets not properly connected, reconnecting...');
        this.initializeAuthenticatedSockets(authStore.token).catch(err => {
          logger.error('[SocketStore] Failed to reconnect authenticated sockets:', err);
        });
      }
    }
  })

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

  isSocketReady(socket: ReturnType<typeof io> | null): boolean {
    return socket?.connected || false;
  }

  isPostsSocketReady(): boolean {
    return this.isSocketReady(this.posts);
  }

  isCommentsSocketReady(): boolean {
    return this.isSocketReady(this.comments);
  }

  isSocketConnected(type: 'posts' | 'comments' | 'users'): boolean {
    const socket = this[type];
    return !!socket && socket.connected;
  }
}

export const socketStore = new SocketStore();