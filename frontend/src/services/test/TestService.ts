import { TestConfig } from '../../utils/test/config';

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

export class TestService {
  private environment: TestEnvironment | null = null;

  setTestEnvironment(config: TestConfig): void {
    this.environment = {
      isActive: true,
      token: config.testToken,
      config,
    };
    console.log('[TestService] Test environment activated:', {
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

  getTestQueryParams(): Record<string, string> | undefined {
    if (!this.environment?.isActive) return undefined;

    return {
      testMode: 'true',
      testToken: this.environment.token,
    };
  }

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
    console.log('[TestService] Cleaning up test environment');
    this.environment = null;
  }
}

// Синглтон
export const testService = new TestService();