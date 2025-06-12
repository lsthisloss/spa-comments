export interface TestConfig {
  testToken: string;
  socketURL: string;
  timeouts: {
    connection: number;
    operation: number;
    response: number;
  };
  delays: {
    betweenPosts: number;
    betweenUsers: number;
    betweenBatches: number;
  };
  limits: {
    batchSize: number;
    maxRetries: number;
  };
  modes: {
    normal: {
      delayBetweenPosts: number;
      delayVariation: number;
      timeoutMultiplier: number;
    };
    crash: {
      delayBetweenPosts: number;
      delayVariation: number;
      timeoutMultiplier: number;
    };
  };
  api: {
    baseURL: string;
    endpoints: {
      users: string;
      posts: string;
      comments: string;
    };
  };
}

export const DEFAULT_CONFIG: TestConfig = {
  testToken: 'sk8-h4ck-t0k3n-1337',
  socketURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeouts: {
    connection: 10000, // Увеличили таймаут соединения
    operation: 45000, // Увеличили таймаут операций
    response: 5000, // Увеличили таймаут ответа
  },
  delays: {
    betweenPosts: 200, // Увеличили задержку между постами
    betweenUsers: 1000, // Увеличили задержку между пользователями
    betweenBatches: 3000, // Увеличили задержку между батчами
  },
  limits: {
    batchSize: 2, // Уменьшили размер батча
    maxRetries: 3,
  },
  modes: {
    normal: {
      delayBetweenPosts: 300, // Увеличили задержки
      delayVariation: 500,
      timeoutMultiplier: 1,
    },
    crash: {
      delayBetweenPosts: 100, // Более консервативные настройки для краш-теста
      delayVariation: 100,
      timeoutMultiplier: 2,
    },
  },
  api: {
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
    endpoints: {
      users: '/users',
      posts: '/posts',
      comments: '/comments',
    },
  },
};