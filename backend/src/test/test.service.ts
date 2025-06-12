import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  id: string;
  email: string;
  userName: string;
  role: 'test';
  avatarUrl?: string;
  avatarShape: 'circle' | 'square';
  slug: string;
}

@Injectable()
export class TestService {
  private readonly testTokens = new Set(['sk8-h4ck-t0k3n-1337']);

  // КЕШИРОВАНИЕ ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ
  private readonly testUsers = new Set<string>();

  isTestMode(testMode: unknown, testToken: unknown): boolean {
    // Безопасное приведение типов
    const isModeTrue = typeof testMode === 'string' && testMode === 'true';
    const tokenString = typeof testToken === 'string' ? testToken : '';
    const isValidToken = this.isValidTestToken(tokenString);
    const result = isModeTrue && isValidToken;

    console.log(`[TestService] Mode check:`, {
      testMode: typeof testMode === 'string' ? testMode : typeof testMode,
      testToken: tokenString ? tokenString.substring(0, 10) + '...' : 'null',
      isModeTrue,
      isValidToken,
      result,
    });

    if (isModeTrue && !isValidToken) {
      console.warn(
        `[TestService] ⚠️ Test mode attempted with invalid token: ${tokenString}`,
      );
    }

    return result;
  }

  private isValidTestToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      console.log(`[TestService] Invalid test token type: ${typeof token}`);
      return false;
    }

    const isValid = this.testTokens.has(token);
    if (!isValid) {
      console.log(
        `[TestService] Invalid test token attempted: ${token ? token.substring(0, 10) + '...' : 'null'}`,
      );
      console.log(
        `[TestService] Valid tokens: ${Array.from(this.testTokens)
          .map((t) => t.substring(0, 10) + '...')
          .join(', ')}`,
      );
    }
    return isValid;
  }

  generateTestUser(clientId: string): TestUser {
    const testUserId = uuidv4();
    const userName = `TestUser_${clientId.substring(0, 8)}`;

    return {
      id: testUserId,
      email: `testuser_${Date.now()}@sk8.pw`,
      userName,
      role: 'test',
      avatarUrl: undefined,
      avatarShape: 'circle',
      slug: userName.toLowerCase(),
    };
  }

  // ДОБАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ В ТЕСТОВЫЕ
  markAsTestUser(userId: string): void {
    this.testUsers.add(userId);
    console.log(
      `[TestService] ✅ MARKED AS TEST USER: ${userId.substring(0, 8)}...`,
    );
  }

  // ПРОВЕРКА ТЕСТОВОГО ПОЛЬЗОВАТЕЛЯ
  isTestUserId(userId: string): boolean {
    const isTest = this.testUsers.has(userId);

    if (isTest) {
      console.log(`[TestService] ✅ TEST USER: ${userId.substring(0, 8)}...`);
    } else {
      console.log(
        `[TestService] ❌ REGULAR USER: ${userId.substring(0, 8)}...`,
      );
    }

    return isTest;
  }

  generateTestUserData(userId: string): {
    userName: string;
    avatarUrl: string | null;
    avatarShape: string;
    slug: string;
    role: string;
  } {
    const hash = userId.replace(/-/g, '').substring(0, 8);
    const animals = [
      'Tiger',
      'Lion',
      'Bear',
      'Eagle',
      'Wolf',
      'Fox',
      'Hawk',
      'Shark',
    ];
    const adjectives = [
      'Cool',
      'Smart',
      'Fast',
      'Kind',
      'Brave',
      'Bold',
      'Swift',
      'Wise',
    ];

    const nameIndex = parseInt(hash.substring(0, 2), 16) % animals.length;
    const adjIndex = parseInt(hash.substring(2, 4), 16) % adjectives.length;
    const number = parseInt(hash.substring(4, 8), 16) % 9999;

    const userName = `${adjectives[adjIndex]}${animals[nameIndex]}${number}`;

    return {
      userName,
      avatarUrl: null,
      avatarShape: 'circle',
      slug: userName.toLowerCase(),
      role: 'test',
    };
  }

  shouldSkipDatabase(testMode: boolean): boolean {
    return testMode;
  }

  getTestUserStats(): {
    patterns: string[];
    cacheSize: number;
    knownTestUsers: string[];
  } {
    return {
      patterns: [],
      cacheSize: this.testUsers.size,
      knownTestUsers: Array.from(this.testUsers),
    };
  }
}
