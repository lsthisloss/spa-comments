import { makeAutoObservable, runInAction } from "mobx";
import { logger } from "../../utils/Logger";
import { stores } from "../stores/stores";
import { connectionService } from "./ConnectionService";

// Деструктурируем хранилища
const { authStore, socketStore } = stores;

export type InitializationStatus = 'idle' | 'initializing' | 'ready' | 'error' | 'server_unavailable';

/*
  Сервис для инициализации приложения.
  Выполняет все необходимые шаги для подготовки приложения к работе:
  - Ждет готовности AuthStore
  - Проверяет авторизацию пользователя
  - Инициализирует сокеты в зависимости от статуса авторизации
  - Запускает мониторинг соединений
*/
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
  private initializationPromise: Promise<void> | null = null;
  
  constructor() {
    makeAutoObservable(this);
  }

  async initialize() {
    // Если уже инициализировано - возвращаем сразу
    if (this.initialized) {
      logger.log("[AppInit] Already initialized, skipping");
      return;
    }

    // Если инициализация уже идет - ждем ее завершения
    if (this.initializing && this.initializationPromise) {
      logger.log("[AppInit] Initialization in progress, waiting for completion");
      await this.initializationPromise;
      return;
    }

    // Создаем promise для отслеживания инициализации
    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
  }

  private async performInitialization() {
    runInAction(() => {
      this.initializing = true;
      this.status = 'initializing';
      this.error = null;
    });

    logger.info("[AppInit] Starting application initialization");
    
    try {
      // 1. Ждем готовности AuthStore (короткий таймаут)
      await this.waitForAuthReady();

      // 2. Проверяем авторизацию и создаем правильный сокет сразу
      const isAuthenticated = authStore.isAuthenticated && authStore.token;
      
      if (isAuthenticated) {
        logger.log("[AppInit] User is authenticated, initializing authenticated sockets directly");
        // Для авторизованных пользователей сразу создаем все сокеты с токеном
        await socketStore.initializeAuthenticatedSockets(authStore.token!);
      } else {
        logger.log("[AppInit] User not authenticated, initializing basic sockets");
        // Для неавторизованных - только базовый users сокет
        await socketStore.initializeBasicSockets();
      }
      
      // 3. Ждем подключения users сокета с таймаутом
      const socketConnected = await this.waitForSocketConnection(10000);
      
      // 4. Устанавливаем статус в зависимости от подключения
      runInAction(() => {
        this.initialized = true;
        this.initializing = false;
        this.socketsReady = socketConnected;
        this.status = socketConnected ? 'ready' : 'server_unavailable';
      });

      // 5. Запускаем мониторинг соединений если подключились
      if (socketConnected && isAuthenticated) {
        // Для авторизованных пользователей ConnectionService уже запущен в SocketStore
        logger.info("[AppInit] Connection monitoring already started for authenticated user");
      } else if (!socketConnected) {
        // Если не подключились, запускаем фоновую проверку
        this.startBackgroundCheck();
      }

      logger.info("[AppInit] Application initialization completed");
      
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error : new Error(String(error));
        this.initializing = false;
        this.status = 'error';
      });
      logger.error("[AppInit] Application initialization failed:", error);
    } finally {
      this.initializationPromise = null;
    }
  }
  private async waitForSocketConnection(timeoutMs = 10000): Promise<boolean> {
    
    // Если сокет уже подключен, сразу возвращаем true
    if (socketStore.users?.connected) {
      return true;
    }
    
    // Ждем подключения с таймаутом
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.warn("[AppInit] Socket connection timeout");
        resolve(false);
      }, timeoutMs);
      
      // Проверяем каждые 100мс, подключился ли сокет
      const checkInterval = setInterval(() => {
        if (socketStore.users?.connected) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          logger.log("[AppInit] Socket connected successfully");
          resolve(true);
        }
      }, 100);
      
      // Также слушаем событие подключения, если сокет существует
      if (socketStore.users) {
        socketStore.users.once('connect', () => {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          logger.log("[AppInit] Socket connected via event");
          resolve(true);
        });
      }
    });
  }

  private startBackgroundCheck() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    
    this.connectionCheckInterval = setInterval(() => {
      // Проверяем статус сокета
      const isConnected = socketStore.users?.connected === true;
      
      // Если статус изменился - обновляем UI
      if (this.socketsReady !== isConnected) {
        runInAction(() => {
          this.socketsReady = isConnected;
          this.status = isConnected ? 'ready' : 'server_unavailable';
        });
        
        // При успешном подключении
        if (isConnected) {
          logger.log("[AppInit] Socket connected in background check");
          connectionService.init(socketStore);
          
          // Очищаем интервал
          if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
          }
        }
      }
    }, 3000);
  }

  private async waitForAuthReady(): Promise<void> {
    // Ждем максимум 2 секунды
    let attempts = 0;
    while (!authStore.isAuthReady && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }

  reset() {
    runInAction(() => {
      this.initialized = false;
      this.initializing = false;
      this.socketsReady = false;
      this.error = null;
      this.status = 'idle';
    });
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    this.initializationPromise = null; // Сбрасываем promise
  }

  async manualRetry(): Promise<void> {
    logger.log("[AppInit] Manual retry requested");
    
    // Отключаем все соединения
    await socketStore.disconnectAllSockets();
    
    // Небольшая пауза для очистки
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Перезапускаем инициализацию
    this.reset();
    await this.initialize();
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

  destroy() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }
}

export const appInitializer = new AppInitializer();

// Очистка при выгрузке страницы
window.addEventListener('beforeunload', () => {
  appInitializer.destroy();
});