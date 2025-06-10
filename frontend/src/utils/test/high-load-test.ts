/**
 * Модуль для высоконагруженного тестирования
 * Поддерживает тестирование с большим количеством пользователей и постов
 * с контролем одновременных потоков выполнения
 */

import { TestConfig, DEFAULT_CONFIG } from './config';
import { TestUserGenerator, PostCreationStats } from './user-generator';
import { testService } from '../../services/test/TestService';

export interface HighLoadTestConfig {
  // Общие настройки теста
  totalUsers: number;        // Общее количество пользователей для создания
  postsPerUser: number;      // Количество постов на одного пользователя
  withMedia: boolean;        // Генерировать ли медиа-контент

  // Настройки параллелизма
  concurrentUsers: number;   // Максимальное количество одновременно создаваемых пользователей
  concurrentPosts: number;   // Максимальное количество одновременно создаваемых постов на пользователя

  // Настройки производительности
  userBatchSize: number;     // Размер одной партии пользователей для создания
  pauseBetweenBatches: number; // Пауза между партиями пользователей (мс)

  // Режим теста
  testMode: 'normal' | 'extreme'; // 'normal' - обычный режим, 'extreme' - максимальная нагрузка
}

export interface HighLoadTestStats {
  // Общая статистика
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: 'pending' | 'running' | 'completed' | 'stopped' | 'failed';

  // Статистика пользователей
  users: {
    total: number;
    created: number;
    failed: number;
    inProgress: number;
  };

  // Статистика постов
  posts: {
    total: number;          // Общее запланированное количество
    created: number;        // Успешно созданы
    queued: number;         // В очереди на сервере
    rateLimited: number;    // Ограничены по частоте
    failed: number;         // Ошибки
    inProgress: number;     // В процессе создания
  };

  // Прогресс
  progress: {
    total: number;          // Общий прогресс в процентах
    users: number;          // Прогресс создания пользователей
    posts: number;          // Прогресс создания постов
  };

  // Система
  system: {
    activeThreads: number;  // Активные потоки
    memoryUsage?: number;   // Использование памяти (если доступно)
    queueSize: number;      // Размер очереди заданий
  };
}

// Настройки по умолчанию для высоконагруженного теста
export const DEFAULT_HIGH_LOAD_CONFIG: HighLoadTestConfig = {
  totalUsers: 1000,
  postsPerUser: 10,
  withMedia: false,
  concurrentUsers: 20,
  concurrentPosts: 50,
  userBatchSize: 1000,
  pauseBetweenBatches: 0.5 * 1000, // 500 мс
  testMode: 'normal'
};

/**
 * Класс для выполнения высоконагруженных тестов
 */
export class HighLoadTestRunner {
  private config: HighLoadTestConfig;
  private baseConfig: TestConfig;
  private stats: HighLoadTestStats;
  private userGenerator: TestUserGenerator;

  private isRunning: boolean = false;
  private isStopped: boolean = false;

  private userQueue: number[] = [];
  private activeThreads: number = 0;
  private completedUsers: Set<number> = new Set();
  private failedUsers: Set<number> = new Set();

  private onProgressCallback?: (stats: HighLoadTestStats) => void;

  /**
   * @param config Конфигурация высоконагруженного теста
   * @param baseConfig Базовая конфигурация тестового окружения
   */
  constructor(
    config: Partial<HighLoadTestConfig> = {},
    baseConfig: TestConfig = DEFAULT_CONFIG
  ) {
    this.config = { ...DEFAULT_HIGH_LOAD_CONFIG, ...config };
    this.baseConfig = { ...baseConfig };

    this.stats = this.initializeStats();

    // Создаем генератор пользователей
    this.userGenerator = new TestUserGenerator(
      this.baseConfig,
      true,
      this.config.withMedia
    );

    // Активируем тестовое окружение
    testService.setTestEnvironment(this.baseConfig);

    console.log(`[HighLoadTest] Initialized with:`, {
      totalUsers: this.config.totalUsers,
      postsPerUser: this.config.postsPerUser,
      totalPosts: this.config.totalUsers * this.config.postsPerUser,
      concurrentUsers: this.config.concurrentUsers,
      withMedia: this.config.withMedia ? 'ENABLED' : 'DISABLED',
      testMode: this.config.testMode
    });
  }

  /**
   * Инициализация статистики
   */
  private initializeStats(): HighLoadTestStats {
    return {
      startTime: new Date(),
      status: 'pending',
      users: {
        total: this.config.totalUsers,
        created: 0,
        failed: 0,
        inProgress: 0
      },
      posts: {
        total: this.config.totalUsers * this.config.postsPerUser,
        created: 0,
        queued: 0,
        rateLimited: 0,
        failed: 0,
        inProgress: 0
      },
      progress: {
        total: 0,
        users: 0,
        posts: 0
      },
      system: {
        activeThreads: 0,
        queueSize: 0
      }
    };
  }

  /**
   * Установка callback для отслеживания прогресса
   */
  onProgress(callback: (stats: HighLoadTestStats) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Обновление статистики и вызов callback
   */
  private updateStats(): void {
    // Обновление прогресса
    this.stats.progress.users = Math.floor(
      ((this.stats.users.created + this.stats.users.failed) / this.stats.users.total) * 100
    );

    this.stats.progress.posts = Math.floor(
      ((this.stats.posts.created + this.stats.posts.queued + this.stats.posts.rateLimited + this.stats.posts.failed) /
        this.stats.posts.total) * 100
    );

    this.stats.progress.total = Math.floor(
      (this.stats.progress.users + this.stats.progress.posts) / 2
    );

    // Обновление системной информации
    this.stats.system.activeThreads = this.activeThreads;
    this.stats.system.queueSize = this.userQueue.length;

    // Вызов callback если он задан
    if (this.onProgressCallback) {
      this.onProgressCallback({ ...this.stats });
    }
  }

  /**
   * Запуск высоконагруженного теста
   */
  /**
   * Запуск высоконагруженного теста
   */
  async runTest(): Promise<HighLoadTestStats> {
    if (this.isRunning) {
      throw new Error('Test is already running');
    }

    this.isRunning = true;
    this.isStopped = false;
    this.stats.status = 'running';
    this.stats.startTime = new Date();

    console.log(`[HighLoadTest] Starting high load test with ${this.config.totalUsers} users × ${this.config.postsPerUser} posts = ${this.stats.posts.total} total posts`);

    try {
      // Инициализация очереди пользователей
      this.userQueue = Array.from({ length: this.config.totalUsers }, (_, i) => i);

      // Запуск обработки очереди
      await this.processUserQueue();

      console.log(`[HighLoadTest] User processing completed, waiting for batch processing...`);

      // Ждем обработки всех батчей (особенно важно для queued постов)
      await this.waitForBatchProcessing();

      // Проверка на принудительную остановку
      if (this.isStopped) {
        this.stats.status = 'stopped';
        console.log(`[HighLoadTest] Test was stopped by user`);
      } else {
        this.stats.status = 'completed';
        console.log(`[HighLoadTest] Test completed successfully`);
      }

      // Финальное обновление статистики
      this.stats.endTime = new Date();
      this.stats.durationMs = this.stats.endTime.getTime() - this.stats.startTime.getTime();

      this.updateStats();

      const totalProcessedPosts = this.stats.posts.created + this.stats.posts.queued + this.stats.posts.rateLimited;

      console.log(`[HighLoadTest] Final statistics:`, {
        duration: `${(this.stats.durationMs! / 1000).toFixed(2)}s`,
        users: `${this.stats.users.created}/${this.stats.users.total} created, ${this.stats.users.failed} failed`,
        posts: `${this.stats.posts.created} immediately created, ${this.stats.posts.queued} queued for processing, ${this.stats.posts.rateLimited} rate limited, ${this.stats.posts.failed} failed`,
        totalPostsProcessed: `${totalProcessedPosts}/${this.stats.posts.total}`,
        progress: `${this.stats.progress.total}%`,
        status: this.stats.status
      });

      if (this.stats.posts.queued > 0) {
        console.log(`[HighLoadTest] 📦 ${this.stats.posts.queued} posts are queued and will be processed by BatchingService`);
        console.log(`[HighLoadTest] 🎯 Check feed in a few seconds to see all posts appear`);
      }

      return { ...this.stats };

    } catch (error) {
      this.stats.status = 'failed';
      this.stats.endTime = new Date();
      this.stats.durationMs = this.stats.endTime.getTime() - this.stats.startTime.getTime();

      console.error(`[HighLoadTest] Test failed:`, error);
      this.updateStats();

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Ожидание обработки батчей
   */
  private async waitForBatchProcessing(): Promise<void> {
    // Ждем небольшое время для завершения socket операций
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Пытаемся принудительно обработать батчи если есть доступ
    try {
      interface WindowWithStores {
        stores?: {
          postStore?: {
            forceFlushBatches?: () => Promise<void>;
            batchingService?: {
              getQueueSize?: () => number;
            };
          };
        };
      }

      const windowWithStores = window as unknown as WindowWithStores;
      const postStore = windowWithStores.stores?.postStore;

      if (postStore) {
        // Проверяем размер очереди если возможно
        if (postStore.batchingService?.getQueueSize) {
          const queueSize = postStore.batchingService.getQueueSize();
          if (queueSize > 0) {
            console.log(`[HighLoadTest] 📦 BatchingService queue size: ${queueSize} posts waiting`);
          }
        }

        // Принудительно обрабатываем батчи если возможно
        if (postStore.forceFlushBatches) {
          console.log(`[HighLoadTest] 🔄 Force flushing batches...`);
          await postStore.forceFlushBatches();
          console.log(`[HighLoadTest] ✅ Batch flush completed`);

          // Дополнительное время на обработку
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.warn(`[HighLoadTest] Could not access BatchingService for flush:`, error);
    }
  }
  /**
   * Остановка теста
   */
  stopTest(): void {
    if (!this.isRunning) return;

    console.log(`[HighLoadTest] Stopping test...`);
    this.isStopped = true;

    // Очищаем очередь
    this.userQueue = [];
  }

  /**
   * Обработка очереди пользователей с ограничением параллельных операций
   */
  private async processUserQueue(): Promise<void> {
    // Разбиваем пользователей на партии для лучшего контроля
    while (this.userQueue.length > 0 && !this.isStopped) {
      const batchSize = Math.min(this.config.userBatchSize, this.userQueue.length);
      const batch = this.userQueue.splice(0, batchSize);

      console.log(`[HighLoadTest] Processing batch of ${batch.length} users (${this.userQueue.length} remaining in queue)`);

      // Обрабатываем одну партию пользователей
      await this.processBatch(batch);

      // Пауза между партиями для стабилизации системы
      if (this.userQueue.length > 0 && !this.isStopped) {
        await new Promise(resolve => setTimeout(resolve, this.config.pauseBetweenBatches));
      }
    }
  }

  /**
   * Обработка одной партии пользователей с ограничением одновременных операций
   */
  private async processBatch(batch: number[]): Promise<void> {
    return new Promise<void>((resolve) => {
      let completed = 0;
      const total = batch.length;

      // Обработчик завершения одного задания
      const onTaskComplete = () => {
        completed++;
        this.activeThreads--;
        this.updateStats();

        // Если все задания выполнены, разрешаем промис
        if (completed === total) {
          resolve();
          return;
        }

        // Запускаем следующее задание если очередь не пуста
        this.startNextTask();
      };

      // Запуск одного задания
      const startNextTask = () => {
        // Проверка на остановку
        if (this.isStopped) {
          // Помечаем оставшиеся как завершенные для корректного разрешения промиса
          completed = total;
          resolve();
          return;
        }

        // Если достигнут лимит одновременных потоков или очередь пуста, завершаем
        if (this.activeThreads >= this.config.concurrentUsers || batch.length === 0) {
          return;
        }

        // Берем следующего пользователя из партии
        const userId = batch.shift();
        if (userId === undefined) return;

        // Увеличиваем счетчик активных потоков
        this.activeThreads++;
        this.stats.users.inProgress++;
        this.updateStats();

        // Запускаем обработку пользователя
        this.processUserAsync(userId)
          .then(() => {
            this.stats.users.inProgress--;
            this.completedUsers.add(userId);
            onTaskComplete();
          })
          .catch((error) => {
            console.error(`[HighLoadTest] Error processing user ${userId}:`, error);
            this.stats.users.inProgress--;
            this.failedUsers.add(userId);
            this.stats.users.failed++;
            onTaskComplete();
          });

        // Продолжаем запускать задания пока есть место
        if (this.activeThreads < this.config.concurrentUsers && batch.length > 0) {
          setTimeout(startNextTask, 0);
        }
      };

      // Начальный запуск обработки для заполнения потоков
      const initialThreads = Math.min(total, this.config.concurrentUsers);
      for (let i = 0; i < initialThreads; i++) {
        startNextTask();
      }

      // Метод для продолжения обработки
      this.startNextTask = startNextTask;
    });
  }

  // Ссылка на метод для продолжения обработки
  private startNextTask: () => void = () => { };

  /**
   * Асинхронная обработка одного пользователя и его постов
   */
  private async processUserAsync(userIndex: number): Promise<void> {
    // Создаем пользователя
    const userResult = await this.userGenerator.createUser(
      userIndex,
      `hltest${this.config.testMode === 'extreme' ? '_ex' : ''}`
    );

    if (!userResult.success || !userResult.user) {
      throw new Error(`Failed to create user ${userIndex}`);
    }

    // Обновляем статистику
    this.stats.users.created++;
    this.updateStats();

    // Если тест остановлен, не создаем посты
    if (this.isStopped) return;

    // Создаем посты с учетом настроек параллельности
    const postMode = this.config.testMode === 'extreme' ? 'crash' : 'normal';

    // В extreme режиме используем максимальную параллельность
    if (this.config.testMode === 'extreme') {
      // Создаем все посты сразу
      const postStats = await this.userGenerator.createPostsWithMedia(
        userResult.user.userName,
        userResult.user.token,
        userResult.user.id,
        this.config.postsPerUser,
        postMode
      );

      // Обновляем статистику
      this.updatePostStats(postStats);
    } else {
      // В обычном режиме создаем посты порциями для лучшего контроля
      const batchSize = Math.min(this.config.concurrentPosts, this.config.postsPerUser);

      for (let i = 0; i < this.config.postsPerUser; i += batchSize) {
        // Если тест остановлен, прерываем создание постов
        if (this.isStopped) break;

        const currentBatchSize = Math.min(batchSize, this.config.postsPerUser - i);

        // Создаем партию постов
        const batchStats = await this.userGenerator.createPostsWithMedia(
          userResult.user.userName,
          userResult.user.token,
          userResult.user.id,
          currentBatchSize,
          postMode
        );

        // Обновляем статистику
        this.updatePostStats(batchStats);


      }
    }
  }

  /**
   * Обновление статистики по постам
   */
  private updatePostStats(postStats: PostCreationStats): void {
    const beforeTotal = this.stats.posts.created + this.stats.posts.queued + this.stats.posts.rateLimited + this.stats.posts.failed;

    this.stats.posts.created += postStats.created;
    this.stats.posts.queued += postStats.queued;
    this.stats.posts.rateLimited += postStats.rateLimited;
    this.stats.posts.failed += postStats.errors;

    const afterTotal = this.stats.posts.created + this.stats.posts.queued + this.stats.posts.rateLimited + this.stats.posts.failed;
    const addedPosts = afterTotal - beforeTotal;

    // Улучшенное логирование
    if (addedPosts > 0) {
      const breakdown = [];
      if (postStats.created > 0) breakdown.push(`${postStats.created} created`);
      if (postStats.queued > 0) breakdown.push(`${postStats.queued} queued`);
      if (postStats.rateLimited > 0) breakdown.push(`${postStats.rateLimited} rate limited`);
      if (postStats.errors > 0) breakdown.push(`${postStats.errors} failed`);

    }

    this.updateStats();
  }

  /**
   * Получение текущей статистики
   */
  getStats(): HighLoadTestStats {
    return { ...this.stats };
  }
}

/**
 * Функция для запуска высоконагруженного теста из UI
 */
export async function runHighLoadTest(
  config: Partial<HighLoadTestConfig> = {}
): Promise<HighLoadTestStats> {
  // Enable high load mode flags
  window.__CRASH_TEST_MODE__ = true;

  // Add highload parameter to URL without navigating
  const url = new URL(window.location.href);
  url.searchParams.set('highload', 'true');
  window.history.replaceState({}, '', url.toString());


  // Создаем экземпляр тестового раннера
  const runner = new HighLoadTestRunner({
    ...config,
    testMode: 'extreme' // Force extreme mode
  });

  let lastLogTime = Date.now();
  runner.onProgress((stats) => {
    const now = Date.now();
    // Выводим статистику каждые 2 секунды
    if (now - lastLogTime > 2000) {
      const totalProcessed = stats.posts.created + stats.posts.queued + stats.posts.rateLimited;
      console.log(`[HighLoadTest] 📈 Progress: ${stats.progress.total}% | Users: ${stats.users.created}/${stats.users.total} | Posts: ${totalProcessed}/${stats.posts.total} (${stats.posts.queued} queued)`);
      lastLogTime = now;
    }
  });

  try {
    // Запускаем тест
    const result = await runner.runTest();

    const totalProcessed = result.posts.created + result.posts.queued + result.posts.rateLimited;
    console.log(`[HighLoadTest] ✅ Test completed successfully:`);
    console.log(`  👥 Users: ${result.users.created} created`);
    console.log(`  📨 Posts: ${totalProcessed} processed (${result.posts.created} immediate, ${result.posts.queued} queued)`);
    console.log(`  ⏱️ Duration: ${result.durationMs ? (result.durationMs / 1000).toFixed(2) : '?'}s`);

    return result;
  } catch (error) {
    console.error('[HighLoadTest] Test failed:', error);
    throw error;
  }
}

// Экспорт singleton для управления текущим тестом
export const highLoadTestManager = (() => {
  let currentRunner: HighLoadTestRunner | null = null;

  return {
    /**
     * Запуск нового теста
     */
    startTest: async (config: Partial<HighLoadTestConfig> = {}): Promise<HighLoadTestStats> => {
      if (currentRunner) {
        throw new Error('Test is already running');
      }

      currentRunner = new HighLoadTestRunner(config);

      try {
        const result = await currentRunner.runTest();
        currentRunner = null;
        return result;
      } catch (error) {
        currentRunner = null;
        throw error;
      }
    },

    /**
     * Остановка текущего теста
     */
    stopTest: (): void => {
      if (!currentRunner) {
        console.warn('[HighLoadTest] No test is currently running');
        return;
      }

      currentRunner.stopTest();
    },

    /**
     * Проверка, запущен ли тест
     */
    isTestRunning: (): boolean => {
      return currentRunner !== null;
    },

    /**
     * Получение текущей статистики
     */
    getCurrentStats: (): HighLoadTestStats | null => {
      if (!currentRunner) return null;
      return currentRunner.getStats();
    }
  };
})();