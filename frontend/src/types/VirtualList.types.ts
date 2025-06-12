import { ReactNode } from 'react';

export interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T) => string;
  estimateItemHeight: (item: T) => number;
  onEndReached?: () => void;
  loading?: boolean;
  emptyComponent?: ReactNode;
  emptyMessage?: string;
  className?: string;
  allLoaded?: boolean;
  debugOptions?: Record<string, unknown>;
  manualMode?: boolean;
  onScrollDown?: () => void;
  enableManualModeTracking?: boolean;
  feedContextId?: string;
  lastViewedItemId?: string;
  scrollToItem?: (id: string) => void;
}