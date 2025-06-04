import { makeAutoObservable, runInAction } from "mobx";
import { logger } from "../utils/Logger";
import { stores } from "./stores"; // Импортируем хранилища из единой точки


// Деструктурируем хранилища
const { authStore, userStore, socketStore } = stores;

export type InitializationStatus = 'idle' | 'initializing' | 'ready' | 'error' | 'server_unavailable';


class AppInitializer {
  initialized = false;
  initializing = false;
  socketsReady = false;
  error: Error | null = null;
  progress = 0;
  status: InitializationStatus = 'idle';
  retryCount = 0;
  maxRetries = 3;
  connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async initialize() {
    if (this.initialized || this.initializing) {
      logger.debug("[AppInit] Initialize already called, skipping");
      return;
    }

    runInAction(() => {
      this.initializing = true;
      this.status = 'initializing';
      this.progress = 10;
      this.error = null;
    });

    logger.info("[AppInit] Starting application initialization");
    
    try {
      // 1. Проверяем доступность сервера
      const isServerAvailable = await this.checkServerHealth();
      if (!isServerAvailable) {
        throw new Error('Server is unavailable. Please try again later.');
      }

      // 2. Ждем готовности AuthStore
      await this.waitForAuthReady();
      runInAction(() => {
        this.progress = 30;
      });

      // 3. Если есть токен и пользователь, инициализируем аутентифицированные сокеты
      if (authStore.token && userStore.user) {
        logger.log("[AppInit] User authenticated, initializing authenticated sockets");
        await socketStore.initializeAuthenticatedSockets(authStore.token);
        runInAction(() => {
          this.progress = 80;
        });
      } else {
        logger.log("[AppInit] User not authenticated, only basic sockets available");
        runInAction(() => {
          this.progress = 60;
        });
      }

      // 4. Ждем готовности сокетов
      await this.waitForSockets();
      
      runInAction(() => {
        this.progress = 100;
        this.initialized = true;
        this.initializing = false;
        this.socketsReady = true;
        this.status = 'ready';
        this.retryCount = 0;
      });

      // Запускаем мониторинг подключения
      //this.startConnectionMonitoring();

      logger.info("[AppInit] Application initialization completed");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isServerError = errorMessage.includes('Server is unavailable') || 
                           errorMessage.includes('websocket error') ||
                           errorMessage.includes('connection failed');

      runInAction(() => {
        this.error = error instanceof Error ? error : new Error(errorMessage);
        this.initializing = false;
        this.progress = 100;
        this.status = isServerError ? 'server_unavailable' : 'error';
      });

      logger.error("[AppInit] Application initialization failed:", error);

      // Автоматический ретрай для серверных ошибок
      if (isServerError && this.retryCount < this.maxRetries) {
        this.scheduleRetry();
      }
    }
  }

  private async checkServerHealth(): Promise<boolean> {
    try {
      // Use the correct endpoint path based on your backend setup
      const response = await fetch('/health', { 
        method: 'GET'
      });
      return response.ok;
    } catch (error) {
      logger.warn("[AppInit] Server health check failed:", error);
      return false;
    }
  }

  private scheduleRetry() {
    runInAction(() => {
      this.retryCount++;
    });
    
    const retryDelay = Math.min(1000 * Math.pow(2, this.retryCount), 10000); // Exponential backoff

    logger.info(`[AppInit] Scheduling retry ${this.retryCount}/${this.maxRetries} in ${retryDelay}ms`);

    setTimeout(() => {
      logger.info(`[AppInit] Attempting retry ${this.retryCount}/${this.maxRetries}`);
      this.reset();
      this.initialize();
    }, retryDelay);
  }

  private startConnectionMonitoring() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    this.connectionCheckInterval = setInterval(() => {
      const isConnected = socketStore.users?.connected;
      
      if (!isConnected && this.status === 'ready') {
        logger.warn("[AppInit] Connection lost, attempting reconnection");
        runInAction(() => {
          this.status = 'server_unavailable';
        });
        
        // Попытка переподключения
        if (this.retryCount < this.maxRetries) {
          this.scheduleRetry();
        }
      }
    }, 10000); // Проверяем каждые 10 секунд
  }

  private async waitForAuthReady(): Promise<void> {
    let attempts = 0;
    while (!authStore.isAuthReady && attempts < 40) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!authStore.isAuthReady) {
      logger.warn("[AppInit] AuthStore initialization timeout");
    }
  }

  private async waitForSockets(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30; // Уменьшили до 3 секунд

    while (attempts < maxAttempts) {
      const usersReady = socketStore.users?.connected === true;
      
      if (userStore.isAuthenticated) {
        // Для авторизованных - проверяем все сокеты
        const postsReady = socketStore.posts?.connected === true;
        const commentsReady = socketStore.comments?.connected === true;
        
        if (usersReady && postsReady && commentsReady) {
          logger.log("[AppInit] All authenticated sockets ready");
          return;
        }
      } else {
        // Для неавторизованных - только users сокет
        if (usersReady) {
          logger.log("[AppInit] Users socket ready");
          return;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    throw new Error("Socket connection timeout. Server may be unavailable.");
  }

  reset() {
    runInAction(() => {
      this.initialized = false;
      this.initializing = false;
      this.socketsReady = false;
      this.error = null;
      this.progress = 0;
      this.status = 'idle';
    });
  }

  async resetForFreshLogin(): Promise<void> {
    logger.info("[AppInit] Resetting for fresh login");
    
    this.reset();
    
    // Очищаем состояние
    socketStore.disconnectAllSockets();
    
    // Даем время на отключение
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Переподключаем базовый сокет
    socketStore.reconnectUsersSocket();
  }

  get isServerUnavailable(): boolean {
    return this.status === 'server_unavailable';
  }

  get canRetry(): boolean {
    return this.retryCount < this.maxRetries && this.status === 'server_unavailable';
  }

  async manualRetry(): Promise<void> {
    logger.info("[AppInit] Manual retry requested");
    this.reset();
    await this.initialize();
  }

  destroy() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }
}

export const appInitializer = new AppInitializer();

// Автозапуск инициализации
setTimeout(() => {
  appInitializer.initialize().catch(err => {
    logger.error("[AppInit] Failed to initialize:", err);
  });
}, 100);

// Очистка при выгрузке страницы
window.addEventListener('beforeunload', () => {
  appInitializer.destroy();
});