// Убираем ref API и упрощаем компонент

import React, { ReactNode, useCallback, useEffect, useRef } from 'react';
import type { VirtualItem as TanStackVirtualItem } from '@tanstack/react-virtual';
import { DebugInfo } from "../ui/modals/DebugInfo";
import { logger } from '../../utils/Logger';

// Убираем VirtualListRef интерфейс - больше не нужен
// export interface VirtualListRef {
//   forceUpdate: () => void;
// }

// Интерфейс для виртуальных элементов
export interface VirtualListItem<T> extends TanStackVirtualItem {
  item: T;
  position?: number;
  height?: number;
}

// Интерфейс пропсов компонента (остается без изменений)
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

// Упрощенный компонент без ref
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

  // Все существующие refs остаются без изменений
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const topSensorRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(loading);
  const isHandlingRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);
  const lastItemsCountRef = useRef(items.length);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const topObserverRef = useRef<IntersectionObserver | null>(null);
  const initialLoadCompleteRef = useRef(false);
  // Все useEffect и функции остаются точно такими же
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

    useEffect(() => {
      if (initialLoadComplete) {
        initialLoadCompleteRef.current = true;
        logger.log('[VirtualList] Setting initialLoadComplete from props');
      }
    }, [initialLoadComplete]);

  useEffect(() => {
  if (items.length > 0 && !initialLoadCompleteRef.current) {
    initialLoadCompleteRef.current = true;
    logger.log('[VirtualList] Initial load completed with', items.length, 'items');
  }
}, [items.length]);

  useEffect(() => {
    const currentItemsCount = items.length;
    
    if (currentItemsCount > lastItemsCountRef.current) {
      logger.log(`[VirtualList] Items increased from ${lastItemsCountRef.current} to ${currentItemsCount}, resetting loading state`);
      
      isHandlingRef.current = false;
      lastLoadTimeRef.current = Date.now();
      lastItemsCountRef.current = currentItemsCount;
    }
  }, [items.length]);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const entry = entries[0];
    if (!entry || !onEndReached) return;
    
    if (entry.isIntersecting) {
      // Если страница только что загрузилась, и контент пуст - вызовем onEndReached
      if (items.length === 0 && !loadingRef.current && !initialLoadCompleteRef.current) {
        logger.log('[VirtualList] Empty list on first render, triggering load');
        initialLoadCompleteRef.current = true;
        onEndReached();
        return;
      }
      
      // Обычная логика обработки пересечения
      if (!initialLoadCompleteRef.current && items.length === 0) {
        logger.log(`[VirtualList] Ignoring first intersection, waiting for initial load to complete`);
        return;
      }
      
      if (isHandlingRef.current || loadingRef.current || allLoaded) {
        return;
      }
      
      const now = Date.now();
      if (now - lastLoadTimeRef.current < 1000) {
        return;
      }
      
      logger.log(`[VirtualList] Intersection triggered loading`);
      isHandlingRef.current = true;
      lastLoadTimeRef.current = now;
      onEndReached();
    }
  }, [onEndReached, allLoaded, items]);

  const handleTopIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    if (!enableManualModeTracking) return;
    
    const entry = entries[0];
    const isAtTop = entry.isIntersecting;
    
    if (isAtTop) {
      logger.log('[VirtualList] User scrolled to top, triggering onScrollToTop');
      onScrollToTop?.();
    } else {
      logger.log('[VirtualList] User scrolled down, triggering onScrollDown');
      onScrollDown?.();
    }
  }, [enableManualModeTracking, onScrollToTop, onScrollDown]);

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

  useEffect(() => {
    if (!enableManualModeTracking || !topSensorRef.current) return;

    const options = {
      threshold: 0.1,
      rootMargin: '0px 0px -90% 0px'
    };

    topObserverRef.current = new IntersectionObserver(handleTopIntersection, options);
    topObserverRef.current.observe(topSensorRef.current);

    logger.log(`[VirtualList] Top-scroll IntersectionObserver setup`);
    
    return () => {
      if (topObserverRef.current) {
        topObserverRef.current.disconnect();
        topObserverRef.current = null;
        logger.log(`[VirtualList] Top-scroll IntersectionObserver disconnected`);
      }
    };
  }, [enableManualModeTracking, handleTopIntersection]);

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
      {enableManualModeTracking && (
        <div 
          ref={topSensorRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '10px',
            pointerEvents: 'none',
            zIndex: -1,
            opacity: 0
          }}
          data-testid="top-sensor"
        />
      )}
      
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