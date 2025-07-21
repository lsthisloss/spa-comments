import '@testing-library/jest-dom';

// Глобальные моки для frontend окружения
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock для IntersectionObserver
(global as any).IntersectionObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = () => [];
};

// Mock для ResizeObserver
(global as any).ResizeObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
};

// Mock для WebSocket (если используется)
(global as any).WebSocket = class {
  constructor() {}
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
};

console.log('✅ React Testing Library setup готов');
