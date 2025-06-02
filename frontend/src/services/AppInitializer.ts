import { makeAutoObservable, runInAction } from "mobx";
import { logger } from "../utils/Logger";
import authStore from "./stores/AuthStore";
import userStore from "./stores/UserStore";
import { socketStore } from "./stores/SocketStore";
import { postStore } from "./stores/PostStore";
import { commentStore } from "./stores/CommentStore";

/**
 * Централизованный класс для управления инициализацией приложения
 */
class AppInitializer {
  initialized = false;
  initializing = false;
  socketsReady = false;
  error: Error | null = null;
  progress = 0;
  private static initializationInProgress = false;

  constructor() {
    makeAutoObservable(this);
  }

  private setProgress(value: number) {
    runInAction(() => {
      this.progress = value;
    });
  }

async initialize() {
  if (this.initialized || this.initializing || AppInitializer.initializationInProgress) {
    logger.debug("[AppInit] Initialize already called, skipping duplicate initialization");
    return;
  }
  AppInitializer.initializationInProgress = true;
  this.initializing = true;
  this.setProgress(5);

  logger.info("[AppInit] Starting application initialization sequence");
  try {
    // 1. Загрузка данных пользователя
    await this.initializeUserData();
    this.setProgress(30);

    // 2. Инициализация сокетов
    if (authStore.isAuthenticated && authStore.token && authStore.userId) {
      logger.log("[AppInit] User authenticated, initializing authenticated sockets");
      await this.initializeAuthenticatedSockets();
      this.setProgress(60);
    } else {
      logger.log("[AppInit] User not authenticated, initializing only basic sockets");
      // Убедимся, что только основной сокет инициализирован
      if (!socketStore.users || !socketStore.users.connected) {
        socketStore.reconnectUsersSocket();
      }
      this.setProgress(50);
    }

      // 3. Настройка обработчиков событий
      this.setupEventHandlers();
      this.setProgress(80);

      // 4. Старт отслеживания статуса сокетов
      this.startSocketStatusTracking();
      this.setProgress(95);

      runInAction(() => {
        this.initialized = true;
        this.initializing = false;
        AppInitializer.initializationInProgress = false;
        this.progress = 100;
      });

      logger.info("[AppInit] Application initialization completed successfully");
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error : new Error(String(error));
        this.initializing = false;
        AppInitializer.initializationInProgress = false;
        this.progress = 100;
      });
      logger.error("[AppInit] Application initialization failed:", error);
    }
  }

  /**
   * Отслеживание статуса подключения сокетов
   */
  private startSocketStatusTracking() {
    // Проверим сразу при старте
    this.updateSocketsReadyStatus();
    
    // Интервал для периодической проверки
    const checkInterval = setInterval(() => {
      this.updateSocketsReadyStatus();
      
      // После успешного подключения можем прекратить интервал
      if (this.socketsReady) {
        clearInterval(checkInterval);
      }
    }, 500);
    
    // Через 10 секунд прекращаем проверку в любом случае
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!this.socketsReady) {
        logger.warn("[AppInit] Socket connection status tracking timed out, some features may be unavailable");
      }
    }, 10000);
  }
  
/**
 * Обновляет статус готовности сокетов
 */
  private updateSocketsReadyStatus() {
    const usersReady = socketStore.users?.connected === true;
    
    let allReady: boolean;
    
    if (authStore.isAuthenticated && authStore.token) {
      // Для авторизованных пользователей проверяем все сокеты
      const postsReady = socketStore.posts?.connected === true;
      const commentsReady = socketStore.comments?.connected === true;
      
      allReady = postsReady && commentsReady && usersReady;
      
      if (allReady !== this.socketsReady) {
        runInAction(() => {
          this.socketsReady = allReady;
        });
        
        logger.info(`[AppInit] Authenticated socket status: posts=${postsReady}, comments=${commentsReady}, users=${usersReady}, all=${allReady}`);
      }
    } else {
      // Для неавторизованных пользователей достаточно только users сокета
      allReady = usersReady;
      
      if (allReady !== this.socketsReady) {
        runInAction(() => {
          this.socketsReady = allReady;
        });
        
        logger.info(`[AppInit] Unauthenticated socket status: users=${usersReady}, ready=${allReady}`);
      }
    }
  }
  
  /**
   * Ожидает готовности сокетов
   * @param timeoutMs Максимальное время ожидания в миллисекундах
   * @returns Promise, который разрешается, когда сокеты готовы или истек таймаут
   */
  async resetForFreshLogin(): Promise<void> {
  logger.info("[AppInit] Resetting application state for fresh login");
  
  // Отключаем все сокеты
  socketStore.disconnectAllSockets();
  
  // Сбрасываем состояние 
  runInAction(() => {
    this.socketsReady = false;
    this.initialized = false;
    this.initializing = false;
    this.error = null;
    AppInitializer.initializationInProgress = false;
  });
  
  // Очищаем весь LocalStorage
  localStorage.clear();
  
  // Сбрасываем состояние авторизации
  authStore.token = null;
  authStore.userId = null;
  authStore.userName = null;
  authStore.isAuthenticated = false;
  
  // Сбрасываем состояние пользователя
  userStore.user = null;
  userStore.isAuthenticated = false;
  userStore.clearUsersCache();
  
  // Делаем небольшую паузу для уверенности, что все очищено
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Инициализируем только базовый сокет для пользователей (без аутентификации)
  socketStore.reconnectUsersSocket();
  
  // Запускаем базовую инициализацию
  setTimeout(() => this.initialize(), 500);
  
  logger.info("[AppInit] Application state reset completed");
  return Promise.resolve();
}

async waitForSockets(timeoutMs: number = 5000): Promise<boolean> {
  if (this.socketsReady) {
    return true;
  }
  
  logger.log(`[AppInit] Waiting for sockets to be ready (timeout: ${timeoutMs}ms)...`);
  
  return new Promise<boolean>((resolve) => {
    // Функция для проверки статуса сокетов
    const checkSocketsStatus = () => {
      const usersReady = socketStore.users?.connected === true;
      
      if (authStore.isAuthenticated && authStore.token) {
        // Для авторизованных пользователей проверяем все сокеты
        const postsReady = socketStore.posts?.connected === true;
        const commentsReady = socketStore.comments?.connected === true;
        return postsReady && commentsReady && usersReady;
      } else {
        // Для неавторизованных пользователей достаточно только users сокета
        return usersReady;
      }
    };
    
    // Если уже готовы сейчас
    if (checkSocketsStatus()) {
      runInAction(() => {
        this.socketsReady = true;
      });
      logger.log('[AppInit] Sockets already ready!');
      resolve(true);
      return;
    }
    
    // Создаем интервал для проверки
    let checkAttempts = 0;
    const interval = setInterval(() => {
      checkAttempts++;
      
      // Переоценить статус сокетов
      const ready = checkSocketsStatus();
      
      // Обновить состояние и проверить готовность
      if (ready && !this.socketsReady) {
        runInAction(() => {
          this.socketsReady = true;
        });
      }
      
      // Проверить готовность или пробовать дальше
      if (this.socketsReady) {
        clearInterval(interval);
        clearTimeout(timeout);
        logger.log(`[AppInit] Sockets ready after ${checkAttempts} attempts`);
        resolve(true);
      }
    }, 100);
    
    // Установить таймаут на случай, если сокеты не подключатся
    const timeout = setTimeout(() => {
      clearInterval(interval);
      logger.warn(`[AppInit] Socket wait timeout after ${timeoutMs}ms`);
      // Проверяем состояние ещё раз перед резолвом
      const finalStatus = checkSocketsStatus();
      runInAction(() => {
        this.socketsReady = finalStatus;
      });
      resolve(finalStatus);
    }, timeoutMs);
  });
}
  /**
   * Инициализирует данные пользователя
   */
  private async initializeUserData(): Promise<void> {
  logger.log("[AppInit] Starting user data initialization");
  
  // Ждем завершения инициализации authStore
  let attempts = 0;
  while (!authStore.initialLoadComplete && attempts < 40) {
    await new Promise(resolve => setTimeout(resolve, 250));
    attempts++;
  }
  
  if (!authStore.initialLoadComplete) {
    logger.warn("[AppInit] AuthStore initialization timeout");
    return;
  }
  
  // Если пользователь аутентифицирован, ждем валидации токена
  if (authStore.isAuthenticated) {
    logger.log("[AppInit] User authenticated, waiting for token validation...");
    
    attempts = 0;
    while (!authStore.tokenValidated && authStore.isAuthenticated && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    if (!authStore.tokenValidated && authStore.isAuthenticated) {
      logger.warn("[AppInit] Token validation timeout or failed");
      authStore.clearAuthData();
    }
  }
  
  logger.log("[AppInit] User data initialization completed");
}

  /**
   * Инициализирует сокеты с аутентификацией
   */
  private async initializeAuthenticatedSockets(): Promise<void> {
    if (!authStore.token) {
      logger.warn("[AppInit] Cannot initialize authenticated sockets: no token available");
      return;
    }
    try {
      await socketStore.initializeAuthenticatedSockets(authStore.token);
    } catch (error) {
      logger.error("[AppInit] Failed to initialize authenticated sockets:", error);
    }
  }

  /**
   * Настраивает обработчики событий для сторов
   */
  private setupEventHandlers(): void {
    let setupCount = 0;
    
    // Настройка обработчиков для PostStore
    if (socketStore.posts) {
      logger.debug("[AppInit] Setting up PostStore event handlers");
      postStore.setupSocketHandlers(socketStore.posts);
      setupCount++;
    }
    
    // Настройка обработчиков для CommentStore
    if (socketStore.comments) {
      logger.debug("[AppInit] Setting up CommentStore event handlers");
      commentStore.setupSocketHandlers(socketStore.comments);
      setupCount++;
    }
    
    logger.info(`[AppInit] Event handlers setup complete (${setupCount} handlers)`);
    }
      
      isSocketReadyFor(type: 'post' | 'comment' | 'user'): boolean {
        switch(type) {
          case 'post':
            return authStore.isAuthenticated ? (socketStore.posts?.connected === true) : false;
          case 'comment':
            return authStore.isAuthenticated ? (socketStore.comments?.connected === true) : false;
          case 'user':
            return socketStore.users?.connected === true;
          default:
            return false;
        }
      }
}

export const appInitializer = new AppInitializer();

// Автоматический запуск инициализации при импорте, с небольшой задержкой
// чтобы другие компоненты успели загрузиться
setTimeout(() => {
  appInitializer.initialize().catch(err => {
    logger.error("[AppInit] Failed to initialize application:", err);
  });
}, 100);