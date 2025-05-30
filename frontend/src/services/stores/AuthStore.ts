import { makeAutoObservable } from "mobx";
import { logger } from "../../utils/Logger";
import { socketStore } from "./SocketStore";

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
        logger.log('[AuthStore]Initializing auth from localStorage');
        this.setAuth(token, userId, userName || 'Anonymous');
      } else {
        logger.log('[AuthStore]No auth data found in localStorage');
      }
    } catch (error) {
      logger.error('[AuthStore]Failed to init auth from localStorage', error);
    } finally {
      this.initialLoadComplete = true;
    }
  }

  async setAuth(token: string, userId: string, userName: string) {
    logger.log(`[AuthStore] Setting auth for user ${userId} (${userName})`);
    
    this.token = token;
    this.userId = userId;
    this.userName = userName;
    this.isAuthenticated = true;
    
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
    this.token = null;
    this.userId = null;
    this.userName = null;
    this.isAuthenticated = false;
    
    try {
      // Remove ALL auth-related localStorage items
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('user');
      
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

  syncWithUserStore(user: { id: string; token: string; userName: string }) {
    logger.log(`[AuthStore] Syncing auth state with user: ${user.id} (${user.userName})`);
    this.setAuth(user.token, user.id, user.userName);
  }
}

const authStoreInstance = new AuthStore();
export default authStoreInstance;