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
  // Состояние менеджера
  const [internalLoading, setInternalLoading] = useState(false);
  const [loadingLock, setLoadingLock] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastItemCountRef = useRef(items.length);
  const recentlyLoadedRef = useRef(false);

  // Простое отслеживание изменений количества элементов
  useEffect(() => {
    if (items.length > lastItemCountRef.current) {
      logger.log(`Items increased from ${lastItemCountRef.current} to ${items.length}, clearing loading lock`);
      setLoadingLock(false);
      setInternalLoading(false);
      
      // Устанавливаем флаг недавней загрузки
      recentlyLoadedRef.current = true;
      
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      // Сбрасываем флаг через 500ms
      setTimeout(() => {
        recentlyLoadedRef.current = false;
        logger.log("Recently loaded flag cleared");
      }, 500);
    }
    lastItemCountRef.current = items.length;
  }, [items.length]);

useEffect(() => {
  // Сбрасываем internalLoading  когда items увеличиваются,
  // и когда завершается внешняя загрузка
  if (!externalLoading && (internalLoading || loadingLock)) {
    logger.log("External loading finished, resetting all loading flags");
    setLoadingLock(false);
    setInternalLoading(false);
    
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }
}, [externalLoading, internalLoading, loadingLock]);

  const handleItemClick = useCallback((itemId: string) => {
    if (onItemClick) {
      onItemClick(itemId);
    }
  }, [onItemClick]);


const handleLoadMore = useCallback(async () => {
  logger.log("[useFeedManager] handleLoadMore called", { 
    loadingLock, 
    internalLoading, 
    externalLoading, 
    allLoaded, 
    itemsCount: items.length 
  });

  if (recentlyLoadedRef.current) {
    logger.log("[useFeedManager] Skipping load more - recently loaded new items");
    return;
  }

  if (loadingLock || internalLoading || externalLoading) {
    logger.log("[useFeedManager] Skipping load more - loading in progress:", { 
      loadingLock, internalLoading, externalLoading 
    });
    return;
  }

  logger.log("[useFeedManager] Triggering load more items");
  setLoadingLock(true);
  setInternalLoading(true);

  try {
    await loadMoreItems();

    recentlyLoadedRef.current = true;

    setTimeout(() => {
      recentlyLoadedRef.current = false;
      logger.log("[useFeedManager] Recently loaded flag cleared");
    }, 1000);
  } catch (error) {
    logger.error("[useFeedManager] Error loading more items:", error);
  } finally {
    setLoadingLock(false);
    setInternalLoading(false);
  }
}, [loadingLock, internalLoading, externalLoading, allLoaded, loadMoreItems, items.length]);


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

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleLoadMore,
    handleItemClick,
    handleFocusItem,
    isLoading: internalLoading || externalLoading || loadingLock,
    hasNewItems: newItemsCount > 0,
  };
}