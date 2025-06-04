import { logger } from "../utils/Logger";
import type  SocketStore  from "./stores/SocketStore";

class ConnectionService {
  private intervalId: NodeJS.Timeout | null = null;
  private socketStore: SocketStore | null = null;

  init(socketStore: SocketStore) {
    if (this.socketStore) return; // ⭐ Уже инициализирован
    
    this.socketStore = socketStore;
    logger.log('[ConnectionService] Starting connection monitoring');
    
    // Первичная проверка
    socketStore.checkConnections();
    
    // Регулярная проверка
    this.intervalId = setInterval(() => {
      socketStore.checkConnections();
    }, 30000);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.log('[ConnectionService] Connection monitoring stopped');
    }
    this.socketStore = null; // ⭐ Очищаем ссылку
  }

  // ⭐ Дополнительные методы для управления
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  restart(socketStore: SocketStore) {
    this.destroy();
    this.init(socketStore);
  }
}

export const connectionService = new ConnectionService();