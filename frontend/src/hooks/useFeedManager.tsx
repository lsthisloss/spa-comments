import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from "../utils/Logger";

interface FeedManagerOptions<T> {
  items: T[];
  loading: boolean;
  allLoaded: boolean;
  loadMoreItems: () => void;
  onItemClick?: (itemId: string) => void;
  getItemId: (item: T) => string;
  newItemsCount?: number;
  handleLoadNewItems?: () => void;
}

export function useFeedManager<T>({
  items,
  loading: externalLoading,
  allLoaded,
  loadMoreItems,
  onItemClick,
  getItemId,
  newItemsCount = 0,
  handleLoadNewItems,
}: FeedManagerOptions<T>) {
  const [internalLoading, setInternalLoading] = useState(false);
  const lastLoadTimeRef = useRef<number>(0);
  const consecutiveLoadsRef = useRef<number>(0);
  const lastItemCountRef = useRef<number>(0);

  // Сбрасываем internal loading при изменении external loading
  useEffect(() => {
    if (!externalLoading && internalLoading) {
      logger.log("[useFeedManager] External loading finished, resetting internal loading");
      setInternalLoading(false);
    }
  }, [externalLoading, internalLoading]);

  // Сбрасываем счетчик последовательных загрузок когда элементы увеличиваются
  useEffect(() => {
    if (items.length > lastItemCountRef.current) {
      consecutiveLoadsRef.current = 0;
      lastItemCountRef.current = items.length;
    }
  }, [items.length]);

  const handleLoadMore = useCallback(async () => {
    const now = Date.now();
    
    logger.log("[useFeedManager] handleLoadMore called", { 
      internalLoading, 
      externalLoading, 
      allLoaded, 
      itemsCount: items.length,
      consecutiveLoads: consecutiveLoadsRef.current,
      timeSinceLastLoad: now - lastLoadTimeRef.current
    });

    // Защита от loading состояний
    if (internalLoading || externalLoading) {
      logger.log("[useFeedManager] Skipping load more - loading in progress");
      return;
    }

    if (allLoaded) {
      logger.log("[useFeedManager] Skipping load more - all items loaded");
      return;
    }

    // ЗАЩИТА ОТ МАССОВОЙ ЗАГРУЗКИ: максимум 3 загрузки подряд
    if (consecutiveLoadsRef.current >= 3) {
      logger.log("[useFeedManager] Skipping load more - too many consecutive loads");
      return;
    }

    // ЗАЩИТА ПО ВРЕМЕНИ: минимум 500ms между загрузками
    if (now - lastLoadTimeRef.current < 500) {
      logger.log("[useFeedManager] Skipping load more - too soon after last load");
      return;
    }

    logger.log("[useFeedManager] Triggering load more items");
    setInternalLoading(true);
    lastLoadTimeRef.current = now;
    consecutiveLoadsRef.current += 1;

    try {
      loadMoreItems();
    } catch (error) {
      logger.error("[useFeedManager] Error loading more items:", error);
      setInternalLoading(false);
      consecutiveLoadsRef.current -= 1;
    }
  }, [internalLoading, externalLoading, allLoaded, loadMoreItems, items.length]);

  const handleItemClick = useCallback((itemId: string) => {
    if (onItemClick) {
      onItemClick(itemId);
    }
  }, [onItemClick]);

  const handleFocusItem = useCallback((itemId: string) => {
    if (handleLoadNewItems) {
      handleLoadNewItems();
    }

    setTimeout(() => {
      const itemIndex = items.findIndex(item => getItemId(item) === itemId);
      if (itemIndex >= 0) {
        const itemElement = document.getElementById(`${getItemId(items[itemIndex])}`);
        if (itemElement) {
          itemElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 500);
  }, [handleLoadNewItems, items, getItemId]);

  return {
    handleLoadMore,
    handleItemClick,
    handleFocusItem,
    isLoading: internalLoading || externalLoading,
    hasNewItems: newItemsCount > 0,
  };
}