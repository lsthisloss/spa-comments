/**
 *  краш-тестирование
 */

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
}

export class CrashTestRunner {
  private config: TestConfig;
  private userGenerator: TestUserGenerator;

  constructor(config: TestConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.userGenerator = new TestUserGenerator(config);
  }

  async runCrashTest(
    usersCount: number = 3,
    postsPerUser: number = 20
  ): Promise<CrashTestResult> {
    console.log(`💥 SIMPLIFIED CRASH TEST: ${usersCount} users × ${postsPerUser} posts = ${usersCount * postsPerUser} total posts`);
    console.log(`🔥 NO avatars - simplified mode`);
    console.log(`📡 Socket URL: ${this.config.socketURL}`);
    console.log(`⚠️ Rate limit: 10 posts/minute per user - sending ${postsPerUser} posts RAPIDLY`);
    
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
      const allUserPromises = [];
      
      console.log(`\n🚀 Creating ${usersCount} users SIMULTANEOUSLY...`);
      
      for (let i = 0; i < usersCount; i++) {
        allUserPromises.push(
          this.createCrashTestUser(i, postsPerUser)
            .then((stats) => {
              successfulUsers++;
              totalStats.created += stats.created;
              totalStats.queued += stats.queued;
              totalStats.rateLimited += stats.rateLimited;
              totalStats.errors += stats.errors;
              
              console.log(`✅ User ${i + 1}: ${stats.created} created, ${stats.queued} queued, ${stats.rateLimited} rate limited, ${stats.errors} errors`);
            })
            .catch((error) => {
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
      };
      
      console.log(`\n💥 SIMPLIFIED CRASH TEST completed!`);
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
    }
  }

  private async createCrashTestUser(
    userIndex: number,
    postsPerUser: number
  ): Promise<PostCreationStats> {
    // Создаем пользователя БЕЗ аватарки
    const userResult = await this.userGenerator.createUser(
      userIndex,
      'crashtest'
    );

    if (!userResult.success || !userResult.user) {
      throw new Error('Failed to create user');
    }

    // Создаем посты в краш-режиме
    return await this.userGenerator.createPostsWithMedia(
      userResult.user.userName,
      userResult.user.token,
      userResult.user.id,
      postsPerUser,
      'crash' // КРАШ-РЕЖИМ: минимальные задержки
    );
  }
}

// Экспорт функции для использования в DebugInfo
export async function crashTestQueue(
  usersCount: number = 3,
  postsPerUser: number = 20
): Promise<CrashTestResult> {
  const runner = new CrashTestRunner();
  return await runner.runCrashTest(usersCount, postsPerUser);
}