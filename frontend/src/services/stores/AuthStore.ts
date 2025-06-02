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

  constructor() {
    makeAutoObservable(this);
    setTimeout(() => {
      this.initFromLocalStorage();
    }, 0);
  }

  initFromLocalStorage() {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const userName = localStorage.getItem('userName');
      
      if (token && userId) {
        logger.log('[AuthStore] Initializing auth from localStorage');
        this.setAuth(token, userId, userName || 'Anonymous');
      } else {
        logger.log('[AuthStore] No auth data found in localStorage');
      }
    } catch (error) {
      logger.error('[AuthStore] Failed to init auth from localStorage', error);
    } finally {
      this.initialLoadComplete = true;
    }
  }

  async setAuth(token: string, userId: string, userName: string) {
    logger.log(`[AuthStore] Setting auth for user ${userId} (${userName})`);
    
    runInAction(() => {
      this.token = token;
      this.userId = userId;
      this.userName = userName;
      this.isAuthenticated = true;
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
    });
    
    try {
      // Remove ALL auth-related localStorage items
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('user');
      
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
    return this.initialLoadComplete && !this.socketsInitializing;
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
  
  // Ensure sockets are properly initialized with new auth
  this.socketsInitializing = true;
  
  // Шаг 1: Инициализируем сокеты с токеном
  if (this.token) {
    socketStore.initializeAuthenticatedSockets(this.token);
  }
  
  // Шаг 2: Слушаем событие подключения всех сокетов
  const socketReadyHandler = () => {
    if (socketStore.posts?.connected && 
        socketStore.comments?.connected && 
        socketStore.users?.connected) {
      
      // Все сокеты подключены, загружаем посты
      logger.log('[AuthStore] All sockets connected, loading posts');
      
      // Используем setTimeout, чтобы дать сокетам закончить инициализацию
      setTimeout(() => {
        import('./PostStore').then(({ postStore }) => {
          // Инициализируем обе ленты - основную и ленту подписок
          logger.log('[AuthStore] Initializing both feeds after authentication');
          
          // Сначала основную ленту
          postStore.resetFeedState("feed");
          postStore.fetchPosts("feed", 1);
          
          // Затем ленту подписок (с небольшой задержкой)
          setTimeout(() => {
            postStore.resetFeedState("following");
            postStore.fetchPosts("following", 1);
          }, 500);
        });
        
        // Отписываемся от события после загрузки
        document.removeEventListener('sockets-ready', socketReadyHandler);
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
      
      import('./PostStore').then(({ postStore }) => {
        // Инициализируем обе ленты при таймауте
        postStore.resetFeedState("feed");
        postStore.fetchPosts("feed", 1);
        
        setTimeout(() => {
          postStore.resetFeedState("following");
          postStore.fetchPosts("following", 1);
        }, 500);
      });
      
      document.removeEventListener('sockets-ready', socketReadyHandler);
      this.socketsInitializing = false;
    }
  }, 5000);
}
}

const authStoreInstance = new AuthStore();
export default authStoreInstance;