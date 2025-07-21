export interface Thread {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: Date;
  commentsCount: number;
}

export class ThreadService {
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

  async deleteThread(id: string): Promise<boolean> {
    const index = this.threads.findIndex(thread => thread.id === id);
    if (index > -1) {
      this.threads.splice(index, 1);
      return true;
    }
    return false;
  }
}