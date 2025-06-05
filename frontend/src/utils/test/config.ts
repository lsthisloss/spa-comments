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
}

export const DEFAULT_CONFIG: TestConfig = {
  testToken: 'sk8-h4ck-t0k3n-1337',
  socketURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeouts: {
    connection: 5000,
    operation: 30000,
    response: 3000,
  },
  delays: {
    betweenPosts: 100,
    betweenUsers: 500,
    betweenBatches: 2000,
  },
  limits: {
    batchSize: 3,
    maxRetries: 3,
  },
  modes: {
    normal: {
      delayBetweenPosts: 200,
      delayVariation: 300,
      timeoutMultiplier: 1,
    },
    crash: {
      delayBetweenPosts: 50,
      delayVariation: 0,
      timeoutMultiplier: 2,
    },
  },
};