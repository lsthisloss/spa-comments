import { postAPI } from "./PostAPI";
import { logger } from "../../utils/Logger";

export class APIManager {
  // Доступные API сервисы
  posts = postAPI;
  // comments = commentAPI; // Добавим позже
  // users = userAPI; // Добавим позже

  // Проверка готовности
  isReady(): boolean {
    return this.posts['getSocket']()?.connected || false;
  }

  // Получение статуса подключений
  getConnectionStatus() {
    return {
      posts: this.posts['getSocket']()?.connected || false,
      // comments: this.comments['getSocket']()?.connected || false,
      // users: this.users['getSocket']()?.connected || false
    };
  }

  // Инициализация
  async initialize() {
    logger.log("[APIManager] Initializing API services");
    return this.waitForConnections();
  }

  // Ожидание подключения
  private async waitForConnections(timeout = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.isReady()) {
        logger.log("[APIManager] API services ready");
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.warn("[APIManager] Timeout waiting for API connections");
    return false;
  }
}

export const api = new APIManager();