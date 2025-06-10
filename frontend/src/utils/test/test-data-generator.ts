/**
 * краш-тестирование
 */

import { message } from "antd";
import { TestUserGenerator, PostCreationStats } from './user-generator';
import { TestConfig, DEFAULT_CONFIG } from './config';

export interface CrashTestResult {
  totalUsers: number;
  successfulUsers: number;
  failedUsers: number;
  totalStats: {
    created: number;
    queued: number;
    rateLimited: number;
    errors: number;
  };
  duration: number;
  stopped?: boolean;
}

// Типизация для window с краш-тест флагом
interface WindowWithCrashTest {
  __CRASH_TEST_MODE__?: boolean;
  stores?: {
    postStore?: {
      forceFlushBatches?: () => Promise<void>;
      resetManualModes?: () => void;
      clearAllQueues?: () => void;
      stopBatchProcessing?: () => void;
      resetBatchStats?: () => void;
    };
    socketStore?: {
      clearTestConnections?: () => void;
    };
    userStore?: {
      clearTestUsers?: () => void;
    };
    mediaStore?: {
      clearCache?: () => void;
    };
  };
}
declare const window: WindowWithCrashTest;

// Глобальная переменная для отслеживания состояния краш-теста
let isCrashTestActive = false;

// Функция для остановки краш-теста
export function stopCrashTest(): void {
  console.log(`⚠️ CRASH TEST STOP REQUESTED`);
  
  // Устанавливаем флаг остановки
  isCrashTestActive = false;
  
  // Убираем глобальный флаг краш-тест режима
  if (window.__CRASH_TEST_MODE__) {
    window.__CRASH_TEST_MODE__ = false;
    console.log(`🛑 Crash test mode disabled by user`);
  }
  
  // Принудительно очищаем все буферы в PostStore
  try {
    const postStore = window.stores?.postStore;
    if (postStore) {
      if (typeof postStore.forceFlushBatches === 'function') {
        console.log(`🔄 Force flushing all batched posts...`);
        postStore.forceFlushBatches();
        console.log(`✅ Emergency flush completed`);
      }
      
      // Add this: Reset manual modes to ensure UI is updated
      if (typeof postStore.resetManualModes === 'function') {
        console.log(`🔄 Resetting manual modes...`);
        postStore.resetManualModes();
        console.log(`✅ Manual modes reset completed`);
      }
    }
  } catch (error) {
    console.error('❌ Error during emergency flush:', error);
  }
  
  message.success('Краш-тест остановлен');
} 

export class CrashTestRunner {
  private userGenerator: TestUserGenerator;

  constructor(config: TestConfig = DEFAULT_CONFIG, generateWithMedia: boolean = true) {
    console.log(`🏗️ Creating COMPLETELY NEW CrashTestRunner with media: ${generateWithMedia}`);
    
    // Создаем совершенно новый экземпляр с клонированным config
    const cleanConfig = JSON.parse(JSON.stringify(config)); // Deep clone
    
    // Убеждаемся что создаем генератор с правильными параметрами
    this.userGenerator = new TestUserGenerator(cleanConfig, true, generateWithMedia);
    
    // Логируем состояние для отладки
    console.log(`🖼️ CrashTest media generation CONFIRMED: ${generateWithMedia ? 'ENABLED' : 'DISABLED'}`);
    console.log(`⚙️ Config cloned and fresh generator created`);
  }
  async runCrashTest(
    usersCount: number = 3,
    postsPerUser: number = 20
  ): Promise<CrashTestResult> {
    console.log(`💥 SIMPLIFIED CRASH TEST: ${usersCount} users × ${postsPerUser} posts = ${usersCount * postsPerUser} total posts`);
    console.log(`⚠️ Rate limit: 10 posts/minute per user - sending ${postsPerUser} posts RAPIDLY`);
    console.log(`🔥 CRASH TEST MODE: Enabled (batching posts for stability)`);
    
    // Set the crash test mode flag
    window.__CRASH_TEST_MODE__ = true;
    
    const startTime = Date.now();
    let successfulUsers = 0;
    let failedUsers = 0;
    
    const totalStats: PostCreationStats = {
      created: 0,
      queued: 0,
      rateLimited: 0,
      errors: 0,
    };

    try {
      // Создаем всех пользователей ОДНОВРЕМЕННО для максимального краша
      const allUserPromises: Promise<void>[] = [];
      
      console.log(`\n🚀 Creating ${usersCount} users SIMULTANEOUSLY...`);
      
      for (let i = 0; i < usersCount; i++) {
        // Проверка флага остановки перед созданием пользователя
        if (!isCrashTestActive) {
          console.log(`🛑 Crash test stopped at user ${i}/${usersCount}`);
          break;
        }
        
        allUserPromises.push(
          this.createCrashTestUser(i, postsPerUser)
            .then((stats) => {
              // Проверка флага остановки после создания пользователя
              if (!isCrashTestActive) return;
              
              successfulUsers++;
              totalStats.created += stats.created;
              totalStats.queued += stats.queued;
              totalStats.rateLimited += stats.rateLimited;
              totalStats.errors += stats.errors;
              
              console.log(`✅ User ${i + 1}: ${stats.created} created, ${stats.queued} queued, ${stats.rateLimited} rate limited, ${stats.errors} errors`);
            })
            .catch((error: Error) => {
              failedUsers++;
              console.error(`❌ User ${i + 1} failed:`, error.message);
            })
        );
      }
      
      // Запускаем ВСЕ одновременно для максимального краша
      await Promise.allSettled(allUserPromises);
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      const result: CrashTestResult = {
        totalUsers: usersCount,
        successfulUsers,
        failedUsers,
        totalStats,
        duration,
        stopped: !isCrashTestActive
      };
      
      console.log(`\n💥 SIMPLIFIED CRASH TEST ${isCrashTestActive ? 'completed' : 'stopped by user'}!`);
      console.log(`⏱️ Duration: ${duration} seconds`);
      console.log(`📊 RESULTS:`);
      console.log(`   👥 Users: ${successfulUsers} successful, ${failedUsers} failed`);
      console.log(`   📦 Posts queued: ${totalStats.queued}`);
      console.log(`   ✅ Posts created immediately: ${totalStats.created}`);
      console.log(`   🚫 Posts rate limited: ${totalStats.rateLimited}`);
      console.log(`   ❌ Post errors: ${totalStats.errors}`);
      
      return result;
      
    } catch (error) {
      console.error('💥 Simplified crash test failed:', error);
      throw error;
    } finally {
      // ОЧИЩАЕМ ФЛАГ И ПРИНУДИТЕЛЬНО ОБРАБАТЫВАЕМ БУФЕРЫ
      console.log(`🔄 Cleaning up crash test mode...`);
      window.__CRASH_TEST_MODE__ = false;
      isCrashTestActive = false;
      
      // Даем время на завершение последних socket событий
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      
      // Принудительно очищаем все буферы в PostStore
      try {
        const postStore = window.stores?.postStore;
        if (postStore && typeof postStore.forceFlushBatches === 'function') {
          console.log(`🔄 Force flushing all batched posts...`);
          await postStore.forceFlushBatches();
          
          // Даем время на обработку буферов
          await new Promise<void>(resolve => setTimeout(resolve, 500));
          console.log(`✅ All batches flushed successfully`);
        }
      } catch (flushError) {
        console.error('❌ Error flushing batches:', flushError);
      }
    }
  }

  private async createCrashTestUser(
    userIndex: number,
    postsPerUser: number
  ): Promise<PostCreationStats> {
    // Проверяем флаг остановки перед созданием пользователя
    if (!isCrashTestActive) {
      return { created: 0, queued: 0, rateLimited: 0, errors: 0 };
    }
    
    // Создаем пользователя БЕЗ аватарки
    const userResult = await this.userGenerator.createUser(
      userIndex,
      'crashtest'
    );

    if (!userResult.success || !userResult.user) {
      throw new Error('Failed to create user');
    }

    // Проверяем флаг остановки перед созданием постов
    if (!isCrashTestActive) {
      return { created: 0, queued: 0, rateLimited: 0, errors: 0 };
    }

    // Создаем посты порциями для лучшей обработки
    const batchSize = Math.min(50, postsPerUser);
    const stats: PostCreationStats = { created: 0, queued: 0, rateLimited: 0, errors: 0 };
    
    for (let i = 0; i < postsPerUser; i += batchSize) {
      // Проверяем остановку теста в каждой итерации
      if (!isCrashTestActive) {
        break;
      }
      
      const currentBatchSize = Math.min(batchSize, postsPerUser - i);
      
      // Создаем текущую порцию постов
      const batchStats = await this.userGenerator.createPostsWithMedia(
        userResult.user.userName,
        userResult.user.token,
        userResult.user.id,
        currentBatchSize,
        'crash'
      );
      
      // Суммируем результаты
      stats.created += batchStats.created;
      stats.queued += batchStats.queued;
      stats.rateLimited += batchStats.rateLimited;
      stats.errors += batchStats.errors;
      
      // Даем немного времени на обработку
      if (i + batchSize < postsPerUser && isCrashTestActive) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return stats;
  }
}

export async function generateTestData(
  usersCount: number = 5,
  postsPerUser: number = 20,
  withComments: boolean = true,
  withMedia: boolean = true
): Promise<void> {
  console.log(`✨ Generating test data: ${usersCount} users with ${postsPerUser} posts each`);
  console.log(`📝 Comments: ${withComments ? 'Yes' : 'No'}`);
  console.log(`🖼️ Media: ${withMedia ? 'Yes' : 'No'}`);

  const config = DEFAULT_CONFIG;
  const generator = new TestUserGenerator(config, true, withMedia);

  try {
    // Создаем пользователей последовательно
    for (let i = 0; i < usersCount; i++) {
      const userIndex = i;

      // Создаем пользователя
      const userResult = await generator.createUser(userIndex);

      if (!userResult.success || !userResult.user) {
        console.error(`❌ Failed to create user ${i + 1}`);
        continue;
      }

      console.log(`✓ Created user ${i + 1}/${usersCount}: ${userResult.user.userName}`);

      // Создаем посты с медиа (если указано)
      await generator.createPostsWithMedia(
        userResult.user.userName,
        userResult.user.token,
        userResult.user.id,
        postsPerUser,
        'normal'
      );

      console.log(`✓ Created ${postsPerUser} posts for user ${i + 1}/${usersCount}`);

      // Небольшая пауза между пользователями
      if (i < usersCount - 1) {
        await new Promise(resolve => setTimeout(resolve, config.delays.betweenUsers));
      }
    }

    console.log(`✅ Test data generation complete!`);
    message.success(`Создано ${usersCount} пользователей и ${usersCount * postsPerUser} постов`);

  } catch (error) {
    console.error('❌ Error generating test data:', error);
    message.error('Ошибка при генерации тестовых данных');
  }
}

// Функция для использования в DebugInfo
export async function crashTestQueue(
  usersCount: number = 3,
  postsPerUser: number = 20,
  generateWithMedia: boolean = true
): Promise<CrashTestResult> {
  console.log(`🎯 Starting crash test...`);
  console.log(`👥 Users: ${usersCount}, 📄 Posts per user: ${postsPerUser}`);
  console.log(`🖼️ Media: ${generateWithMedia ? 'ENABLED' : 'DISABLED'}`);
  
  // Устанавливаем глобальный флаг краш-теста
  isCrashTestActive = true;
  window.__CRASH_TEST_MODE__ = true;

  // Создаем новый экземпляр runner с нужными настройками
  const runner = new CrashTestRunner(DEFAULT_CONFIG, generateWithMedia);

  try {
    const result = await runner.runCrashTest(usersCount, postsPerUser);
    console.log(`✅ Crash test completed successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Crash test failed:`, error);
    throw error;
  } finally {
    // Сбрасываем флаги
    isCrashTestActive = false;
    window.__CRASH_TEST_MODE__ = false;
    console.log(`🧹 Crash test flags reset`);
  }
}