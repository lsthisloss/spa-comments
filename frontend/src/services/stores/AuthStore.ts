import { makeAutoObservable, runInAction } from "mobx";
import { logger } from "../../utils/Logger";
import { socketStore } from "./SocketStore";
import userStore from "./UserStore";

class AuthStore {
  token: string | null = null;
  userId: string | null = null;
  userName: string | null = null;
  isAuthenticated = false;
  initialLoadComplete = false;
  socketsInitializing = false;
  tokenValidated = false; // Добавляем флаг валидации токена

  constructor() {
    makeAutoObservable(this);
    setTimeout(() => {
      this.initFromLocalStorage();
    }, 0);
  }

  async initFromLocalStorage() {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const userName = localStorage.getItem('userName');
      
      if (token && userId) {
        logger.log('[AuthStore] Found auth data in localStorage, validating...');
        
        // Сначала устанавливаем данные
        await this.setAuth(token, userId, userName || 'Anonymous');
        
        // Затем валидируем токен с бэкендом
        await this.validateTokenWithBackend();
      } else {
        logger.log('[AuthStore] No auth data found in localStorage');
      }
    } catch (error) {
      logger.error('[AuthStore] Failed to init auth from localStorage', error);
      this.clearAuthData();
    } finally {
      this.initialLoadComplete = true;
    }
  }

  async validateTokenWithBackend(): Promise<boolean> {
    if (!this.token || !this.userId) {
      return false;
    }

    try {
      logger.log('[AuthStore] Validating token with backend...');
      
      // Ждем подключения сокета пользователей
      let attempts = 0;
      while (!socketStore.users?.connected && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 250));
        attempts++;
      }

      if (!socketStore.users?.connected) {
        throw new Error('Users socket not connected');
      }

      // Пытаемся получить данные пользователя для валидации токена
      const user = await userStore.getUserById(this.userId);
      
      if (user && user.id === this.userId) {
        logger.log('[AuthStore] Token validation successful');
        this.tokenValidated = true;
        return true;
      } else {
        throw new Error('User validation failed');
      }
    } catch (error) {
      logger.error('[AuthStore] Token validation failed:', error);
      this.clearAuthData();
      return false;
    }
  }

  clearAuthData() {
    logger.log('[AuthStore] Clearing invalid auth data');
    
    runInAction(() => {
      this.token = null;
      this.userId = null;
      this.userName = null;
      this.isAuthenticated = false;
      this.tokenValidated = false;
    });

    try {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('user');
      localStorage.removeItem('userSlug');
    } catch (e) {
      logger.error('[AuthStore] Failed to clear localStorage', e);
    }
  }

  async setAuth(token: string, userId: string, userName: string) {
    logger.log(`[AuthStore] Setting auth for user ${userId} (${userName})`);
    
    runInAction(() => {
      this.token = token;
      this.userId = userId;
      this.userName = userName;
      this.isAuthenticated = true;
      this.tokenValidated = false; // Сбрасываем флаг валидации
    });
    
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('userId', userId);
      localStorage.setItem('userName', userName);
      
      logger.log('[AuthStore] Auth setup complete');
    } catch (error) {
      logger.error('[AuthStore] Failed during auth setup', error);
    }
  }

  logout() {
    logger.log('[AuthStore] Logging out user');
    
    runInAction(() => {
      this.token = null;
      this.userId = null;
      this.userName = null;
      this.isAuthenticated = false;
      this.tokenValidated = false;
    });
    
    try {
      // Remove ALL auth-related localStorage items
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('user');
      localStorage.removeItem('userSlug');
      
      userStore.clearUser();
      
      // Fully disconnect all sockets to force reconnection on next login
      socketStore.disconnectAllSockets();
      
      // Use a public method to reconnect the users socket
      setTimeout(() => {
        socketStore.reconnectUsersSocket();
      }, 500);
    } catch (error) {
      logger.error('[AuthStore] Failed to clear localStorage', error);
    }
  }
  
  get isAuthReady(): boolean {
    return this.initialLoadComplete && !this.socketsInitializing && this.tokenValidated;
  }

syncWithUserStore(user: { id: string; token: string; userName: string; slug?: string }) {
  logger.log(`[AuthStore] Syncing auth state with user: ${user.id} (${user.userName})`);
  this.setAuth(user.token, user.id, user.userName);
  
  // Store additional user info
  if (user.slug) {
    try {
      localStorage.setItem('userSlug', user.slug);
    } catch (e) {
      logger.error('[AuthStore] Failed to save slug to localStorage', e);
    }
  }
  
  // Prevent multiple socket initializations
  if (this.socketsInitializing) {
    logger.log('[AuthStore] Socket initialization already in progress, skipping');
    return;
  }
  
  // Ensure sockets are properly initialized with new auth
  this.socketsInitializing = true;
  
  // Шаг 1: Инициализируем сокеты с токеном
  if (this.token) {
    socketStore.initializeAuthenticatedSockets(this.token);
  }
  
  // Шаг 2: Слушаем событие подключения всех сокетов - ТОЛЬКО ОДИН РАЗ
  const socketReadyHandler = () => {
    if (socketStore.posts?.connected && 
        socketStore.comments?.connected && 
        socketStore.users?.connected) {
      
      logger.log('[AuthStore] All sockets connected, loading posts ONCE');
      
      // Отписываемся СРАЗУ чтобы избежать повторных вызовов
      document.removeEventListener('sockets-ready', socketReadyHandler);
      
      // Используем setTimeout, чтобы дать сокетам закончить инициализацию
      setTimeout(() => {
        import('./PostStore').then(({ postStore }) => {
          // Проверяем что мы все еще в процессе инициализации
          if (!this.socketsInitializing) {
            logger.log('[AuthStore] Socket initialization was cancelled, skipping post load');
            return;
          }
          
          logger.log('[AuthStore] Initializing both feeds after authentication');
          
          // Сначала основную ленту
          postStore.resetFeedState("feed");
          postStore.fetchPosts("feed", 1);
          
          // Затем ленту подписок (с небольшой задержкой)
          setTimeout(() => {
            if (this.socketsInitializing) { // Еще одна проверка
              postStore.resetFeedState("following");
              postStore.fetchPosts("following", 1);
            }
          }, 500);
        });
        
        this.socketsInitializing = false;
      }, 300);
    }
  };
  
  // Добавляем слушатель на событие готовности сокетов
  document.addEventListener('sockets-ready', socketReadyHandler);
  
  // Таймаут на случай, если событие не сработает
  setTimeout(() => {
    if (this.socketsInitializing) {
      logger.log('[AuthStore] Timeout reached, loading posts anyway');
      
      // Отписываемся от события
      document.removeEventListener('sockets-ready', socketReadyHandler);
      
      import('./PostStore').then(({ postStore }) => {
        // Инициализируем обе ленты при таймауте
        postStore.resetFeedState("feed");
        postStore.fetchPosts("feed", 1);
        
        setTimeout(() => {
          postStore.resetFeedState("following");
          postStore.fetchPosts("following", 1);
        }, 500);
      });
      
      this.socketsInitializing = false;
    }
  }, 5000);
}
}

const authStoreInstance = new AuthStore();
export default authStoreInstance;