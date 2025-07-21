interface Thread {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: Date;
  commentsCount: number;
}

class ThreadService {
  private threads: Thread[] = [];

  async createThread(thread: Omit<Thread, 'id' | 'createdAt' | 'commentsCount'>): Promise<Thread> {
    const newThread: Thread = {
      ...thread,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      commentsCount: 0
    };
    
    this.threads.push(newThread);
    return newThread;
  }

  async getThreads(): Promise<Thread[]> {
    return [...this.threads];
  }

  async getThreadById(id: string): Promise<Thread | null> {
    return this.threads.find(thread => thread.id === id) || null;
  }
}

describe('ThreadService Unit Tests', () => {
  let threadService: ThreadService;

  beforeEach(() => {
    threadService = new ThreadService();
  });

  test('should create a new thread', async () => {
    const threadData = {
      title: 'Test Thread',
      content: 'Test content',
      author: 'test-user'
    };

    const result = await threadService.createThread(threadData);

    expect(result).toMatchObject({
      title: 'Test Thread',
      content: 'Test content',
      author: 'test-user',
      commentsCount: 0
    });
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  test('should return empty array when no threads exist', async () => {
    const result = await threadService.getThreads();
    expect(result).toEqual([]);
  });

  test('should return thread by id', async () => {
    const thread = await threadService.createThread({
      title: 'Test Thread',
      content: 'Test content',
      author: 'test-user'
    });

    const result = await threadService.getThreadById(thread.id);
    expect(result).toEqual(thread);
  });

  test('should return null for non-existent thread', async () => {
    const result = await threadService.getThreadById('non-existent');
    expect(result).toBeNull();
  });
});