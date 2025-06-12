import { logger } from '../../utils/Logger';

/*
  В разработке. Для возврата с любого пейджа в то же состояние. 
*/

export interface SnapshotContext {
  itemsCount?: number;
  originalSource?: string;
  username?: string;
  timestamp?: number;
  restoredFrom?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ViewportSnapshot {
  scrollPosition: number;
  timestamp: number;
  originalSource?: string;
  context?: SnapshotContext;
  [key: string]: string | number | boolean | undefined | SnapshotContext;

}

class GlobalSnapshotManager {
  private snapshots = new Map<string, ViewportSnapshot>();

  constructor() {
    logger.log('[GlobalSnapshots] Created GlobalSnapshotManager');
  }

saveSnapshot(key: string, scrollPosition: number, metadata?: Record<string, string | number | boolean | undefined>) {
  if (scrollPosition < 100) {
    logger.log(`[GlobalSnapshots] Skipping save for ${key}: position too low (${scrollPosition}px)`);
    return;
  }

  this.snapshots.set(key, {
    scrollPosition,
    timestamp: Date.now(),
    ...metadata, 
  });

  logger.log(`[GlobalSnapshots] Saved snapshot for ${key}: ${scrollPosition}px`);
}

getSnapshot(key: string): ViewportSnapshot | null {
  const snapshot = this.snapshots.get(key);
  if (snapshot) {
    logger.log(`[GlobalSnapshots] Retrieved snapshot for ${key}: ${snapshot.scrollPosition}px`);

    return snapshot;
  }
  
  logger.log(`[GlobalSnapshots] No snapshot found for ${key}`);
  return null;
}
  clearSnapshot(feedKey: string): void {
    if (this.snapshots.delete(feedKey)) {
      logger.log(`[GlobalSnapshots] Cleared snapshot for ${feedKey}`);
    }
  }

  hasSnapshot(feedKey: string): boolean {
    return this.snapshots.has(feedKey);
  }

  getAllSnapshots(): Map<string, ViewportSnapshot> {
    return new Map(this.snapshots);
  }

  clearAllSnapshots(): void {
    this.snapshots.clear();
    logger.log('[GlobalSnapshots] Cleared all snapshots');
  }

  getSnapshotKeys(): string[] {
    return Array.from(this.snapshots.keys());
  }

  getSnapshotsCount(): number {
    return this.snapshots.size;
  }

  updateSnapshotContext(feedKey: string, context: Partial<SnapshotContext>): boolean {
    const snapshot = this.snapshots.get(feedKey);
    if (snapshot) {
      snapshot.context = { ...snapshot.context, ...context };
      logger.log(`[GlobalSnapshots] Updated context for ${feedKey}`);
      return true;
    }
    return false;
  }
}

// Экспортируем глобальный экземпляр
export const globalSnapshotManager = new GlobalSnapshotManager();

// Экспортируем Map для обратной совместимости
export const globalSnapshots = globalSnapshotManager.getAllSnapshots();