import { action } from 'mobx';
import { logger } from '../../utils/Logger';
import { FeedType } from '../../types/enums';
import { Post } from '../../types/interfaces';

/*
  Интерфейсы и типы для батчинга данных
  Используются для настройки и управления батчами в BatchingService
*/
export interface BatchConfig {
  sizes: {
    fixed: number;
    adaptive: {
      tiny: number;
      small: number;
      medium: number;
      large: number;
      huge: number;
      massive: number;
    };
  };
  timing: {
    idle: number;
    low: number;
    medium: number;
    high: number;
    extreme: number;
    crashTest: number;
  };
  thresholds: {
    low: number;
    medium: number;
    high: number;
    extreme: number;
    massive: number;
  };
  triggers: {
    start: number;
    restart: number;
  };
  logging: {
    normal: number;
    interval: number;
  };
}
// Интерфейс для трекинга нагрузки
export interface LoadTracker {
  recentActivity: number[];
  currentLoad: 'idle' | 'low' | 'medium' | 'high' | 'extreme';
  lastProcessTime: number;
  consecutiveHighLoad: number;
}
// Интерфейс для статистики батчей
export interface BatchStats {
  processed: number;
  total: number;
  batches: number;
  lastLog: number;
  missed: number;
}

export type BatchProcessor<T> = (items: T[], feedType: FeedType) => void;

interface WindowWithCrashTest extends Window {
  __CRASH_TEST_MODE__?: boolean;
  __USER_STORE__?: { user?: { id: string } };
}
declare const window: WindowWithCrashTest;

/**
 * Сервис для управления батчингом данных
 */
export class BatchingService<T = Post> {
  private readonly config: BatchConfig = {
    sizes: {
      fixed: 25,
      adaptive: {
        tiny: 5,
        small: 15,
        medium: 35,
        large: 75,
        huge: 150,
        massive: 300
      }
    },
    timing: {
      idle: 2000,
      low: 400,
      medium: 200,
      high: 100,
      extreme: 50,
      crashTest: 50
    },
    thresholds: {
      low: 20,
      medium: 100,
      high: 300,
      extreme: 600,
      massive: 1000
    },
    triggers: {
      start: 25,
      restart: 10
    },
    logging: {
      normal: 50,
      interval: 2000
    }
  };

  // Стратегия батчинга
  private strategy: 'fixed' | 'adaptive' = 'adaptive';

  // Буферы для элементов
  private buffers: Map<FeedType, T[]> = new Map();

  // Таймеры для обработки
  private timeouts: Map<FeedType, NodeJS.Timeout> = new Map();

  // Трекинг нагрузки
  private loadTrackers: Map<FeedType, LoadTracker> = new Map();

  // Статистика
  private stats: Map<FeedType, BatchStats> = new Map();

  // Флаги обработки
  private processingFlags: Map<FeedType, boolean> = new Map();

  // Процессор для обработки батчей
  private processor: BatchProcessor<T>;
  constructor(processor: BatchProcessor<T>) {
    this.processor = processor;

    // Очистка памяти каждые 30 секунд
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.cleanupMemory();
      }, 30000);

      const isCrashTest = window.__CRASH_TEST_MODE__ === true;
      // Если в режиме краш-теста, используем специальные настройки
      // В реальном приложении такой поток для клиента даже и не нужен, это только для тестов
      if (isCrashTest) {
        this.config.sizes.adaptive.massive = 200;
        this.config.sizes.adaptive.huge = 100;
        this.config.sizes.adaptive.large = 75;
        this.config.sizes.adaptive.medium = 50;
        this.config.sizes.adaptive.small = 25;

        logger.log('[BatchingService] 🚀 CRASH TEST MODE - Using MEMORY-SAFE batches');
      }
    }
  }

  /**
   * Очистка памяти
   */
  private cleanupMemory = action(() => {
    // Очистка старых данных из трекеров
    this.loadTrackers.forEach((tracker) => {
      if (tracker.recentActivity.length > 5) {
        tracker.recentActivity = tracker.recentActivity.slice(-3);
      }
    });

    // Принудительная обработка переполненных буферов
    this.buffers.forEach((buffer, feedType) => {
      if (buffer.length > 200) {
        logger.warn(`[BatchingService] 🧹 Auto-cleanup: Processing ${buffer.length} items in ${feedType}`);
        this.forceProcessBatch(feedType);
      }
    });
  });

  /*
    Включение режима высокой нагрузки
    Этот метод позволяет вручную включить режим высокой нагрузки с адаптивной стратегией и большими батчами.
    Используется для тестирования и отладки в условиях высокой нагрузки.
    Важно: этот метод должен вызываться только в тестовой среде, так как он изменяет конфигурацию батчинга.
  */
  enableHighLoadMode = action(() => {
    window.__CRASH_TEST_MODE__ = true;

    this.strategy = 'adaptive';

    this.config.sizes.adaptive.tiny = 25;
    this.config.sizes.adaptive.small = 75;
    this.config.sizes.adaptive.medium = 150;
    this.config.sizes.adaptive.large = 300;
    this.config.sizes.adaptive.huge = 500;
    this.config.sizes.adaptive.massive = 1000;

    // Ускоряем обработку
    this.config.timing.idle = 50;
    this.config.timing.low = 25;
    this.config.timing.medium = 15;
    this.config.timing.high = 10;
    this.config.timing.extreme = 5;
    this.config.timing.crashTest = 5;

    // пороги для быстрого переключения на большие батчи  
    this.config.thresholds.low = 50;
    this.config.thresholds.medium = 200;
    this.config.thresholds.high = 500;
    this.config.thresholds.extreme = 1000;
    this.config.thresholds.massive = 2000;

    this.config.triggers.start = 25;

    // Clear all pending timeouts
    this.clearAllTimeouts();

    // Process all pending buffers immediately
    this.buffers.forEach((_, feedType) => {
      this.forceProcessBatch(feedType);
    });

    logger.log('[BatchingService] 🚀 HIGH LOAD MODE ENABLED MANUALLY - Using adaptive strategy with massive batches');
    return true;
  });

  /**
   * Добавляет элемент в батч
   */
  addToBatch = action((item: T, feedType: FeedType, itemId: string) => {
    const isCrashTest = window.__CRASH_TEST_MODE__ === true;

    // Инициализируем буфер и статистику если нужно
    this.initializeForFeed(feedType, isCrashTest);

    const buffer = this.buffers.get(feedType)!;
    const stats = this.stats.get(feedType)!;

    // Проверяем дубликаты
    if (!this.hasDuplicate(buffer, itemId)) {
      buffer.push(item);

      if (isCrashTest) {
        stats.total++;

        if (stats.total % 50 === 0) {
          logger.log(`[BatchingService] MILESTONE: ${stats.total} total items received for ${feedType} feed`);
        }
      }
    }

    // Обновляем трекинг нагрузки
    this.updateLoadTracking(feedType);

    // Определяем нужно ли обработать сейчас
    if (this.shouldProcessNow(feedType)) {
      this.processImmediate(feedType, isCrashTest);
    } else if (!isCrashTest) {
      this.scheduleProcessing(feedType);
    }
  });

  /**
   * Инициализация для ленты
   */
  private initializeForFeed(feedType: FeedType, isCrashTest: boolean) {
    if (!this.buffers.has(feedType)) {
      this.buffers.set(feedType, []);
    }

    if (!this.loadTrackers.has(feedType)) {
      this.loadTrackers.set(feedType, {
        recentActivity: [],
        currentLoad: 'idle',
        lastProcessTime: Date.now(),
        consecutiveHighLoad: 0
      });
    }

    if (isCrashTest && !this.stats.has(feedType)) {
      this.stats.set(feedType, {
        processed: 0,
        total: 0,
        batches: 0,
        lastLog: Date.now(),
        missed: 0
      });

      logger.log(`[BatchingService] Initialized batching for ${feedType} feed with ${this.strategy} strategy`);
    }

    if (!this.processingFlags.has(feedType)) {
      this.processingFlags.set(feedType, false);
    }
  }

  /**
   * Проверка дубликатов (переопределяется в зависимости от типа)
   */
  private hasDuplicate(buffer: T[], itemId: string): boolean {
    // Для постов проверяем по id
    return buffer.some((item) => (item as T & { id: string }).id === itemId);
  }

  /**
   * Определение уровня нагрузки на основе размера буфера
   */
  private getLoadLevel(bufferSize: number): 'idle' | 'low' | 'medium' | 'high' | 'extreme' {
    if (bufferSize >= this.config.thresholds.massive) {
      return 'extreme';
    } else if (bufferSize >= this.config.thresholds.extreme) {
      return 'extreme';
    } else if (bufferSize >= this.config.thresholds.high) {
      return 'high';
    } else if (bufferSize >= this.config.thresholds.medium) {
      return 'medium';
    } else if (bufferSize >= this.config.thresholds.low) {
      return 'low';
    } else {
      return 'idle';
    }
  }

  private updateLoadTracking(feedType: FeedType) {
    const tracker = this.loadTrackers.get(feedType);
    if (!tracker) return;

    const now = Date.now();
    const buffer = this.buffers.get(feedType) || [];
    const bufferSize = buffer.length;

    // Используем единую логику определения нагрузки
    tracker.currentLoad = this.getLoadLevel(bufferSize);

    // Обновляем активность каждые 1 секунду
    const timeSinceLastProcess = now - tracker.lastProcessTime;
    if (timeSinceLastProcess > 1000) {
      tracker.recentActivity.push(bufferSize);

      // Храним только последние 20 измерений
      if (tracker.recentActivity.length > 20) {
        tracker.recentActivity.shift();
      }

      tracker.lastProcessTime = now;
    }

    // Отслеживаем последовательную высокую нагрузку
    if (tracker.currentLoad === 'high' || tracker.currentLoad === 'extreme') {
      tracker.consecutiveHighLoad++;
    } else {
      tracker.consecutiveHighLoad = 0;
    }
  }

  private shouldProcessNow(feedType: FeedType): boolean {
    const buffer = this.buffers.get(feedType) || [];
    const isProcessing = this.processingFlags.get(feedType) || false;

    if (isProcessing) {
      return false;
    }

    // Используем config.triggers для определения когда начинать
    const bufferSize = buffer.length;
    const loadLevel = this.getLoadLevel(bufferSize);

    // Начинаем обработку при достижении определенных порогов
    if (loadLevel === 'extreme') return true;  // Критическая нагрузка
    if (loadLevel === 'high') return true;     // Высокая нагрузка
    if (loadLevel === 'medium') return true;   // Средняя нагрузка

    // Для низкой нагрузки - используем trigger.start
    return bufferSize >= this.config.triggers.start;
  }

  private getBatchSize(feedType: FeedType): number {
    const buffer = this.buffers.get(feedType) || [];
    const bufferSize = buffer.length;
    const loadLevel = this.getLoadLevel(bufferSize);

    // Используем config.sizes.adaptive для определения размера батча
    switch (loadLevel) {
      case 'extreme':
        return this.config.sizes.adaptive.massive;  // 1000 в краш-тесте
      case 'high':
        return this.config.sizes.adaptive.huge;     // 500 в краш-тесте  
      case 'medium':
        return this.config.sizes.adaptive.large;    // 300 в краш-тесте
      case 'low':
        return this.config.sizes.adaptive.medium;   // 150 в краш-тесте
      case 'idle':
      default:
        return this.config.sizes.adaptive.small;    // 75 в краш-тесте
    }
  }

  private getProcessingInterval(feedType: FeedType): number {
    const buffer = this.buffers.get(feedType) || [];
    const bufferSize = buffer.length;
    const loadLevel = this.getLoadLevel(bufferSize);

    // Используем config.timing для определения интервала
    return this.config.timing[loadLevel];
  }

  forceProcessBatch = action((feedType: FeedType) => {
    logger.log(`[BatchingService] Force processing batch for ${feedType}`);

    // Clear any scheduled processing
    this.clearTimeout(feedType);

    // Process immediately
    this.processBatch(feedType, false);

    // Return true if any items were processed
    return (this.buffers.get(feedType)?.length || 0) > 0;
  });

  /**
   * Немедленная обработка
   */
  private processImmediate = action((feedType: FeedType, isCrashTest: boolean) => {
    if (this.processingFlags.get(feedType)) return;

    // Очищаем запланированную обработку
    this.clearTimeout(feedType);

    this.processingFlags.set(feedType, true);

    setTimeout(() => {
      this.processBatch(feedType, isCrashTest);
      this.processingFlags.set(feedType, false);

      // Проверяем нужна ли еще обработка
      const buffer = this.buffers.get(feedType) || [];
      if (buffer.length > 0) {
        this.addToBatch(buffer[0], feedType, (buffer[0] as T & { id: string }).id);
      }
    }, this.config.timing.crashTest);
  });

  /**
   * Планирование обработки
   */
  private scheduleProcessing(feedType: FeedType) {
    this.clearTimeout(feedType);

    const interval = this.getProcessingInterval(feedType);
    const tracker = this.loadTrackers.get(feedType);

    if (tracker) {
      logger.log(`[BatchingService] Scheduled processing for ${feedType} in ${interval}ms (load: ${tracker.currentLoad})`);
    }

    const timeout = setTimeout(() => {
      this.processBatch(feedType, false);
    }, interval);

    this.timeouts.set(feedType, timeout);
  }
  private processBatch = action((feedType: FeedType, isCrashTest: boolean) => {
    const buffer = this.buffers.get(feedType);
    if (!buffer || buffer.length === 0) return;

    const maxSafeBatchSize = isCrashTest ? 500 : 100;
    const batchSize = Math.min(this.getBatchSize(feedType), maxSafeBatchSize);
    const portion = buffer.splice(0, Math.min(batchSize, buffer.length));

    if (portion.length === 0) return;

    const userStore = (window as WindowWithCrashTest).__USER_STORE__;

    try {
      if (userStore) {
        this.processWithUserCheck(portion, feedType, userStore);
      } else {
        this.processor(portion, feedType);
      }
    } finally {
      portion.length = 0;
      portion.splice(0);
    }

    const stats = this.stats.get(feedType);
    const tracker = this.loadTrackers.get(feedType);

    // Логирование только для критических случаев
    if (buffer.length >= 1000) {
      logger.warn(`[BatchingService] ⚠️ MEMORY WARNING: ${buffer.length} items in ${feedType} buffer!`);
    }

    // Обновляем статистику
    if (stats) {
      stats.processed += portion.length;
      stats.batches++;
    }

    if (tracker) {
      tracker.lastProcessTime = Date.now();
      if (tracker.recentActivity.length > 10) {
        tracker.recentActivity = tracker.recentActivity.slice(-5); // Оставляем только 5 последних
      }
    }

    // Агрессивная очистка для больших буферов
    if (buffer.length > 500) {
      setTimeout(() => {
        if (!this.processingFlags.get(feedType)) {
          this.processBatch(feedType, isCrashTest);
        }
      }, 5);
    } else if (buffer.length > 0 && !isCrashTest) {
      this.scheduleProcessing(feedType);
    }

    this.clearTimeout(feedType);
  });

  forceFlushAll = action(() => {

    logger.log("[BatchingService] 🧹 EMERGENCY MEMORY CLEANUP");

    this.buffers.forEach((buffer, feedType) => {
      // Обрабатываем небольшими порциями чтобы не убить память
      while (buffer.length > 0) {
        const safeBatchSize = Math.min(buffer.length, 50);
        const portion = buffer.splice(0, safeBatchSize);

        if (portion.length > 0) {
          try {
            this.processor(portion, feedType);
          } finally {
            // Принудительно очищаем для GC
            portion.length = 0;
          }
        }

        if (buffer.length > 0 && buffer.length % 100 === 0) {
          logger.log(`[BatchingService] 🧹 Cleanup progress: ${buffer.length} remaining in ${feedType}`);
        }
      }
    });

    // Полная очистка памяти
    this.clearAllTimeouts();
    this.buffers.clear();
    this.loadTrackers.clear();
    this.stats.clear();
    this.processingFlags.clear();

    // Принудительный GC если доступен
    if (global.gc) {
      global.gc();
      logger.log("[BatchingService] 🧹 Forced garbage collection");
    }

    logger.log("[BatchingService] 🧹 EMERGENCY CLEANUP COMPLETE");
  });

  /**
   * Установка стратегии батчинга
   */
  setStrategy = action((strategy: 'fixed' | 'adaptive') => {
    this.strategy = strategy;
    logger.log(`[BatchingService] Strategy set to: ${strategy}`);
  });

  /**
   * Получение статистики
   */
  getStats(feedType: FeedType): BatchStats | undefined {
    return this.stats.get(feedType);
  }

  /**
   * Получение информации о буфере
   */
  getBufferInfo(feedType: FeedType): { size: number; load: string } {
    const buffer = this.buffers.get(feedType) || [];
    const tracker = this.loadTrackers.get(feedType);

    return {
      size: buffer.length,
      load: tracker?.currentLoad || 'unknown'
    };
  }

  // Метод для обработки батчей с проверкой на пользователя
  public processWithUserCheck = action((items: T[], feedType: FeedType, userStore: { user?: { id: string } }) => {
    if (!items.length) return;

    // Standard processing first
    this.processor(items, feedType);

    // Then check for and dispatch events for user's own posts
    const userId = userStore?.user?.id;
    if (userId) {
      items.forEach(item => {
        // Check if this is user's own post
        if ((item as T & { userId: string }).userId === userId) {
          logger.log(`[BatchingService] Found user's own item, dispatching userPostAdded event`);

          // Dispatch event with the needed data structure
          window.dispatchEvent(new CustomEvent('userPostAdded', {
            detail: {
              post: item,
              isCurrentUser: true,
              feedType: feedType
            }
          }));

          // Force scroll to top after a slight delay (to ensure UI updates)
          setTimeout(() => {
            window.scrollTo(0, 0);
          }, 50);
        }
      });
    }
  });
  
  /**
   * Сброс статистики
   */
  resetStats = action(() => {
    this.stats.clear();
    this.loadTrackers.clear();
    logger.log('[BatchingService] Statistics reset');
  });

  /**
   * Очистка всех очередей
   */
  clearAllQueues = action(() => {
    this.buffers.clear();
    this.clearAllTimeouts();
    this.processingFlags.clear();
    logger.log('[BatchingService] All queues and timers cleared');
  });

  /**
   * Очистка таймаута для конкретной ленты
   */
  private clearTimeout(feedType: FeedType) {
    const timeout = this.timeouts.get(feedType);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(feedType);
    }
  }

  /**
   * Очистка всех таймаутов
   */
  private clearAllTimeouts() {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
  }

  /**
   * Освобождение ресурсов
   */
  dispose() {
    this.clearAllTimeouts();
    this.buffers.clear();
    this.loadTrackers.clear();
    this.stats.clear();
    this.processingFlags.clear();
    logger.log('[BatchingService] Disposed');
  }
}