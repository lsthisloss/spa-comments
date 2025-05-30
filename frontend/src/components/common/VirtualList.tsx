import React, { ReactNode, useCallback, useEffect, useRef } from 'react';
import type { VirtualItem as TanStackVirtualItem } from '@tanstack/react-virtual';
import { DebugInfo } from "../ui/modals/DebugInfo";
import { logger } from '../../utils/Logger';

export interface VirtualListItem<T> extends TanStackVirtualItem {
  item: T;
  position?: number;
  height?: number;
}

interface VirtualListProps<T> {
  items: T[];
  renderItem: (virtualItem: VirtualListItem<T>, measureRef: (el: HTMLElement | null) => void) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  totalHeight: number;
  virtualItems: VirtualListItem<T>[];
  measureElement: (el: HTMLElement | null, index: number) => void;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  loading?: boolean;
  loadingIndicator?: ReactNode;
  emptyComponent?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  allLoaded?: boolean;
  debugOptions?: Record<string, unknown>;
  manualMode?: boolean;
  onScrollToTop?: () => void;
  onScrollDown?: () => void;
  enableManualModeTracking?: boolean;
  initialLoadComplete?: boolean;
}

function VirtualList<T>(props: VirtualListProps<T>) {
  const {
    items,
    renderItem,
    getItemKey,
    totalHeight,
    virtualItems,
    measureElement,
    onEndReached,
    endReachedThreshold = 800,
    loading = false,
    loadingIndicator,
    emptyComponent,
    className = '',
    style,
    allLoaded = false,
    debugOptions = {},
    manualMode = false,
    onScrollToTop,
    onScrollDown,
    enableManualModeTracking = false,
    initialLoadComplete = false,
  } = props;

  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(loading);
  const isHandlingRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);
  const lastItemsCountRef = useRef(items.length);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const initialLoadCompleteRef = useRef(false);

  // Синхронизация loadingRef
  useEffect(() => {
    loadingRef.current = loading;
    logger.log(`[VirtualList] Loading state updated: ${loading}`);
  }, [loading]);

  // Синхронизация initialLoadCompleteRef с пропом
  useEffect(() => {
    if (initialLoadComplete) {
      initialLoadCompleteRef.current = true;
      logger.log('[VirtualList] Setting initialLoadComplete from props');
    }
  }, [initialLoadComplete]);

  // Сброс isHandlingRef после загрузки
  useEffect(() => {
    if (!loading && isHandlingRef.current) {
      logger.log('[VirtualList] Loading finished, reset isHandlingRef');
      isHandlingRef.current = false;
    }
  }, [loading]);

  // Установка initialLoadCompleteRef при появлении items
  useEffect(() => {
    if (items.length > 0 && !initialLoadCompleteRef.current) {
      initialLoadCompleteRef.current = true;
      logger.log('[VirtualList] Initial load completed with', items.length, 'items');
    }
  }, [items.length]);

  // Сброс флагов при очистке items
  useEffect(() => {
    if (items.length === 0) {
      isHandlingRef.current = false;
      initialLoadCompleteRef.current = false;
      lastItemsCountRef.current = 0;
      logger.log('[VirtualList] Items reset, flags cleared');
    }
  }, [items.length]);

  // Сброс isHandlingRef при увеличении items (новая страница)
  useEffect(() => {
    const currentItemsCount = items.length;
    if (currentItemsCount > lastItemsCountRef.current) {
      logger.log(`[VirtualList] Items increased from ${lastItemsCountRef.current} to ${currentItemsCount}, resetting loading state`);
      isHandlingRef.current = false;
      lastLoadTimeRef.current = Date.now();
      lastItemsCountRef.current = currentItemsCount;
    }
  }, [items.length]);

  // Главная логика IntersectionObserver
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const entry = entries[0];
    if (!entry || !onEndReached) return;

    if (entry.isIntersecting) {
      // Если список пуст и не грузится — всегда пробуем загрузить
      if (items.length === 0 && !loadingRef.current) {
        logger.log('[VirtualList] Empty list, triggering load');
        isHandlingRef.current = true;
        initialLoadCompleteRef.current = false;
        onEndReached();
        return;
      }

      // Если уже грузим или всё загружено — не грузим
      if (isHandlingRef.current || loadingRef.current || allLoaded) {
        return;
      }

      // Если только что загрузили — не грузим слишком часто
      const now = Date.now();
      if (now - lastLoadTimeRef.current < 500) {
        return;
      }

      // Ключевой момент: если initialLoadCompleteRef сброшен, но посты есть — разрешаем догрузку!
      if (!initialLoadCompleteRef.current && items.length > 0 && !loadingRef.current && !allLoaded) {
        logger.log('[VirtualList] Forcing load more: items exist but initialLoadCompleteRef is false');
        isHandlingRef.current = true;
        lastLoadTimeRef.current = now;
        onEndReached();
        return;
      }

      logger.log(`[VirtualList] Intersection triggered loading`);
      isHandlingRef.current = true;
      lastLoadTimeRef.current = now;
      onEndReached();
    }
  }, [onEndReached, allLoaded, items]);

  // Manual mode переключение по скроллу (без второго observer)
  useEffect(() => {
    if (!enableManualModeTracking) return;
    const firstVisibleIndex = virtualItems[0]?.index ?? 0;
    if (firstVisibleIndex > 0 && !manualMode) {
      logger.log('[VirtualList] User scrolled down, enabling manual update mode');
      onScrollDown?.();
    } else if (firstVisibleIndex === 0 && manualMode) {
      logger.log('[VirtualList] User scrolled to top, disabling manual update mode');
      onScrollToTop?.();
    }
  }, [virtualItems, manualMode, enableManualModeTracking, onScrollDown, onScrollToTop]);

  // Setup IntersectionObserver (только один)
  useEffect(() => {
    if (!sentinelRef.current || !onEndReached) return;
    const options = {
      root: null,
      rootMargin: `${endReachedThreshold}px`,
      threshold: 0,
    };
    observerRef.current = new IntersectionObserver(handleIntersection, options);
    observerRef.current.observe(sentinelRef.current);
    logger.log(`[VirtualList] Load-more IntersectionObserver setup with threshold ${endReachedThreshold}px`);
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
        logger.log(`[VirtualList] Load-more IntersectionObserver disconnected`);
      }
    };
  }, [onEndReached, endReachedThreshold, handleIntersection]);

  if (items.length === 0 && !loading && emptyComponent) {
    return <>{emptyComponent}</>;
  }

  const debugProps = {
    itemsCount: items.length,
    virtualItems,
    loading,
    allLoaded,
    totalHeight,
    measuredItems: virtualItems.length,
    isHandling: isHandlingRef.current,
    lastLoadTime: lastLoadTimeRef.current,
    cooldownRemaining: Math.max(0, 1000 - (Date.now() - lastLoadTimeRef.current)),
    manualMode,
    ...(debugOptions || {})
  };

  return (
    <div className={`virtual-list-container ${className}`}>
      <div 
        ref={listRef}
        style={{
          width: '100%',
          position: 'relative',
          height: `${totalHeight}px`,
          ...style
        }}
      >
        {virtualItems.map((virtualItem) => {
          const itemKey = getItemKey(virtualItem.item, virtualItem.index);
          const topPosition = virtualItem.position ?? virtualItem.start ?? 0;

          return (
            <div
              key={itemKey}
              id={`virtual-item-${itemKey}`}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                transform: `translateY(${topPosition}px)`,
                left: 0,
                width: '100%',
                height: 'auto',
                willChange: 'transform',
              }}
            >
              {renderItem(virtualItem, (el) => measureElement(el, virtualItem.index))}
            </div>
          );
        })}
      </div>
      
      <div style={{ 
        position: 'relative',
        width: '100%',
        zIndex: 1,
        marginTop: '40px',
        marginBottom: '60px',
        minHeight: '100px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: loading ? 'rgba(24, 144, 255, 0.05)' : 'transparent',
        borderRadius: '12px',
        border: loading ? '1px dashed rgba(24, 144, 255, 0.3)' : 'none',
        transition: 'all 0.3s ease'
      }}>
        <div 
          ref={sentinelRef} 
          style={{ 
            position: 'absolute', 
            bottom: '20px', 
            width: '100%', 
            height: '1px', 
            opacity: 0 
          }} 
          data-testid="sentinel"
        />
        
        {items.length > 0 && loadingIndicator}
      </div>
      
      {process.env.NODE_ENV === 'development' && <DebugInfo {...debugProps} />}
    </div>
  );
}

export default VirtualList;