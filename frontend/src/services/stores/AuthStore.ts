import { makeAutoObservable, runInAction } from "mobx";
import { logger } from "../../utils/Logger";

/*
  AuthStore - отвечает за управление состоянием авторизации пользователя.
  Хранит токен, ID и имя пользователя, а также синхронизирует данные с localStorage.
  Инициализируется при создании и проверяет наличие данных в localStorage.
*/
class AuthStore {
  token: string | null = null; // Токен авторизации пользователя
  userId: string | null = null; // ID пользователя
  userName: string | null = null; // Имя пользователя
  initialLoadComplete = false; // Флаг, указывающий, что начальная загрузка завершена

  constructor() {
    makeAutoObservable(this);
    setTimeout(() => {
      this.initFromLocalStorage();
    }, 0);
  }
  // Инициализация из localStorage
  async initFromLocalStorage() {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const userName = localStorage.getItem('userName');
      
      if (token) {
        logger.log('[AuthStore] Found token in localStorage');
        runInAction(() => {
          this.token = token;
          this.userId = userId;
          this.userName = userName;
        });
      } else {
        logger.log('[AuthStore] No token found in localStorage');
      }
    } catch (error) {
      logger.error('[AuthStore] Failed to init auth from localStorage', error);
      this.clearAuthData();
    } finally {
      runInAction(() => {
        this.initialLoadComplete = true;
      });
    }
  }
  // Установка токена и данных пользователя
  setAuth(token: string, userId?: string, userName?: string) {
    logger.log(`[AuthStore] Setting auth token`);
    
    runInAction(() => {
      this.token = token;
      if (userId) this.userId = userId;
      if (userName) this.userName = userName;
    });
    
    try {
      localStorage.setItem('token', token);
      if (userId) localStorage.setItem('userId', userId);
      if (userName) localStorage.setItem('userName', userName);
      logger.log('[AuthStore] Auth data saved to localStorage');
    } catch (error) {
      logger.error('[AuthStore] Failed to save auth data to localStorage', error);
    }
  }

  // Синхронизация с UserStore
  syncWithUserStore(userData: { id: string; token: string; userName: string }) {
    logger.log('[AuthStore] Syncing with UserStore');
    
    runInAction(() => {
      this.token = userData.token;
      this.userId = userData.id;
      this.userName = userData.userName;
    });
    
    try {
      localStorage.setItem('token', userData.token);
      localStorage.setItem('userId', userData.id);
      localStorage.setItem('userName', userData.userName);
    } catch (error) {
      logger.error('[AuthStore] Failed to sync with UserStore', error);
    }
  }

  // Очистка данных авторизации
  clearAuthData() {
    logger.log('[AuthStore] Clearing auth data');
    
    runInAction(() => {
      this.token = null;
      this.userId = null;
      this.userName = null;
    });
    
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
    } catch (e) {
      logger.error('[AuthStore] Failed to clear localStorage', e);
    }
  }
  // Метод для выхода из системы
  logout() {
    logger.log('[AuthStore] Logging out');
    this.clearAuthData();
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  get isAuthReady(): boolean {
    return this.initialLoadComplete;
  }
}

export default AuthStore;