/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'smoke',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/*.smoke.test.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest'
      }
    },
    {
    displayName: 'e2e',
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.e2e.test.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest'
    }
    },
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/*.unit.test.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest'
      }
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/*.integration.test.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest'
      }
    }
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts'
  ]
};