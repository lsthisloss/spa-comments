import { makeAutoObservable, runInAction } from "mobx";
import { logger } from "../../utils/Logger";

class AuthStore {
  token: string | null = null;
  initialLoadComplete = false;

  constructor() {
    makeAutoObservable(this);
    setTimeout(() => {
      this.initFromLocalStorage();
    }, 0);
  }

  async initFromLocalStorage() {
    try {
      const token = localStorage.getItem('token');
      
      if (token) {
        logger.log('[AuthStore] Found token in localStorage');
        this.token = token;
      } else {
        logger.log('[AuthStore] No token found in localStorage');
      }
    } catch (error) {
      logger.error('[AuthStore] Failed to init auth from localStorage', error);
      this.clearAuthData();
    } finally {
      this.initialLoadComplete = true;
    }
  }

  setAuth(token: string) {
    logger.log(`[AuthStore] Setting auth token`);
    
    runInAction(() => {
      this.token = token;
    });
    
    try {
      localStorage.setItem('token', token);
      logger.log('[AuthStore] Token saved to localStorage');
    } catch (error) {
      logger.error('[AuthStore] Failed to save token to localStorage', error);
    }
  }

  clearAuthData() {
    logger.log('[AuthStore] Clearing auth data');
    
    runInAction(() => {
      this.token = null;
    });
    
    try {
      localStorage.removeItem('token');
    } catch (e) {
      logger.error('[AuthStore] Failed to clear localStorage', e);
    }
  }

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

const authStoreInstance = new AuthStore();
export default authStoreInstance;