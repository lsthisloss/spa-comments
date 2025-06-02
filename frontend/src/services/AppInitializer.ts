import { makeAutoObservable, runInAction } from "mobx";
import { logger } from "../utils/Logger";
import authStore from "./stores/AuthStore";
import userStore from "./stores/UserStore";
import { socketStore } from "./stores/SocketStore";

class AppInitializer {
  initialized = false;
  initializing = false;
  socketsReady = false;
  error: Error | null = null;
  progress = 0;

  constructor() {
    makeAutoObservable(this);
  }

  async initialize() {
    if (this.initialized || this.initializing) {
      logger.debug("[AppInit] Initialize already called, skipping");
      return;
    }

    this.initializing = true;
    this.progress = 10;

    logger.info("[AppInit] Starting application initialization");
    
    try {
      // 1. Ждем готовности AuthStore
      await this.waitForAuthReady();
      this.progress = 30;

      // 2. Если есть токен и пользователь, инициализируем аутентифицированные сокеты
      if (authStore.token && userStore.user) {
        logger.log("[AppInit] User authenticated, initializing authenticated sockets");
        await socketStore.initializeAuthenticatedSockets(authStore.token);
        this.progress = 80;
      } else {
        logger.log("[AppInit] User not authenticated, only basic sockets available");
        this.progress = 60;
      }

      // 3. Ждем готовности сокетов
      await this.waitForSockets();
      this.progress = 100;

      runInAction(() => {
        this.initialized = true;
        this.initializing = false;
        this.socketsReady = true;
      });

      logger.info("[AppInit] Application initialization completed");
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error : new Error(String(error));
        this.initializing = false;
        this.progress = 100;
      });
      logger.error("[AppInit] Application initialization failed:", error);
    }
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
    const maxAttempts = 50; // 5 секунд

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
    
    logger.warn("[AppInit] Socket readiness timeout");
  }

  async resetForFreshLogin(): Promise<void> {
    logger.info("[AppInit] Resetting for fresh login");
    
    runInAction(() => {
      this.initialized = false;
      this.initializing = false;
      this.socketsReady = false;
      this.error = null;
      this.progress = 0;
    });
    
    // Очищаем состояние
    socketStore.disconnectAllSockets();
    
    // Даем время на отключение
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Переподключаем базовый сокет
    socketStore.reconnectUsersSocket();
  }
}

export const appInitializer = new AppInitializer();

// Автозапуск инициализации
setTimeout(() => {
  appInitializer.initialize().catch(err => {
    logger.error("[AppInit] Failed to initialize:", err);
  });
}, 100);