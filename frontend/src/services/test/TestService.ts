import { TestConfig } from '../../utils/test/config';
import { logger } from '../../utils/Logger';

export interface TestEnvironment {
  isActive: boolean;
  token: string;
  config: TestConfig;
}

export interface SocketOptions {
  query?: Record<string, string>;
  transports: ['websocket'];
  timeout: number;
  forceNew: boolean;
  reconnection: boolean;
}
// Расширяем глобальный интерфейс Window для поддержки тестового сервиса
declare global {
  interface Window {
    stores?: {
      socketStore?: {
        reconnectAll?: () => void;
      };
    };
  }
}

/*
  TestService - сервис для управления тестовым окружением
  и взаимодействия с тестовыми сокетами.
*/
export class TestService {
  private environment: TestEnvironment | null = null;

  setTestEnvironment(config: TestConfig): void {
    this.environment = {
      isActive: true,
      token: config.testToken,
      config,
    };
    logger.log('[TestService] Test environment activated:', {
      token: config.testToken,
      socketURL: config.socketURL,
    });
  }

  getTestEnvironment(): TestEnvironment | null {
    return this.environment;
  }

  /**
   * Всегда возвращает false - тестовый сервис доступен везде
   */
  isTestMode(): boolean {
    return false;
  }
  
  /**
   * Возвращает параметры запроса для тестового сокета
   * Если тестовое окружение не активно - возвращает undefined
   */
  getTestQueryParams(): Record<string, string> | undefined {
    if (!this.environment?.isActive) return undefined;

    return {
      testMode: 'true',
      testToken: this.environment.token,
    };
  }

  /**
   * Возвращает параметры сокета для тестового окружения
   * Если тестовое окружение не активно - возвращает пустой объект
   */
  getTestSocketOptions(): SocketOptions | Record<string, never> {
    if (!this.environment?.isActive) return {};

    const baseOptions: SocketOptions = {
      query: this.getTestQueryParams(),
      transports: ['websocket'],
      timeout: this.environment.config.timeouts.connection,
      forceNew: true,
      reconnection: false,
    };

    return baseOptions;
  }

  shouldUseTestSocket(): boolean {
    return !!this.environment?.isActive;
  }

  cleanup(): void {
    logger.log('[TestService] Cleaning up test environment');
    this.disconnectTestSockets();
    this.environment = null;
  }

  reset(): void {
    logger.log('[TestService] Resetting test environment');
    this.cleanup();
  }

  disconnectTestSockets(): void {
    logger.log('[TestService] Disconnecting test sockets');
    if (typeof window !== 'undefined' && 
        window.stores?.socketStore?.reconnectAll) {
      try {
        logger.log('[TestService] Forcing socket reconnection');
        window.stores.socketStore.reconnectAll();
      } catch (e) {
        console.error('[TestService] Error reconnecting sockets:', e);
      }
    }
  }
}

// Синглтон
export const testService = new TestService();