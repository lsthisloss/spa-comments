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
      displayName: 'react',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/src'],
      testMatch: ['**/*.react.test.ts', '**/*.react.test.tsx'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx'
          }
        }]
      },
      setupFilesAfterEnv: ['<rootDir>/src/config/test-setup.ts'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub'
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.test.{ts,tsx}'
      ]
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