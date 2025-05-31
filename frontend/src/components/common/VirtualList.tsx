import React, { ReactNode, useCallback, useEffect, useRef } from 'react';
import type { VirtualItem as TanStackVirtualItem } from '@tanstack/react-virtual';
import { DebugInfo } from "../ui/modals/DebugInfo";
import { logger } from '../../utils/Logger';
import { LoadingIndicator } from '../ui/particles/LoadingIndicator';
import { Empty } from 'antd';

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
  emptyMessage?: string;
  loadingMessage?: string;
  className?: string;
  style?: React.CSSProperties;
  allLoaded?: boolean;
  debugOptions?: Record<string, unknown>;
  manualMode?: boolean;
  onScrollToTop?: () => void;
  onScrollDown?: () => void;
  enableManualModeTracking?: boolean;
  initialLoadComplete?: boolean;
  feedContextId?: string;
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
    emptyMessage = 'No items found',
    loadingMessage = 'Loading items...',
    className = '',
    style,
    allLoaded = false,
    debugOptions = {},
    manualMode = false,
    onScrollDown,
    enableManualModeTracking = false,
    initialLoadComplete = false,
    feedContextId,
  } = props;

  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(loading);
  const isHandlingRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);
  const lastItemsCountRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const initialLoadCompleteRef = useRef(false);
  const lastFeedContextIdRef = useRef(feedContextId);
  const emptyLoadAttemptsRef = useRef<number>(0);
  // Синхронизация loadingRef
  useEffect(() => {
    loadingRef.current = loading;
    logger.log(`[VirtualList] Loading state updated: ${loading}`);
  }, [loading]);

  // Отслеживание смены контекста фида - ПРИОРИТЕТ 1
  useEffect(() => {
    if (feedContextId && feedContextId !== lastFeedContextIdRef.current) {
      logger.log(`[VirtualList] Feed context changed from ${lastFeedContextIdRef.current} to ${feedContextId}`);
      
      // Только обновляем контекст, НЕ сбрасываем состояние
      lastFeedContextIdRef.current = feedContextId;
    }
  }, [feedContextId]);

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

  // Сброс флагов при очистке items - ПРИОРИТЕТ 2
  useEffect(() => {
    if (items.length === 0) {
      isHandlingRef.current = false;
      initialLoadCompleteRef.current = false;
      lastItemsCountRef.current = 0;
      logger.log('[VirtualList] Items reset, flags cleared');
    }
  }, [items.length]);

  // Обработка увеличения items (догрузка) - ПРИОРИТЕТ 3
  useEffect(() => {
    const currentItemsCount = items.length;
    const lastCount = lastItemsCountRef.current;
    
    // Если контекст поменялся, просто обновляем счетчик без логирования догрузки
    if (feedContextId !== lastFeedContextIdRef.current) {
      lastItemsCountRef.current = currentItemsCount;
      return;
    }
    
    // Увеличение количества элементов = догрузка в том же контексте
    if (currentItemsCount > lastCount && lastCount > 0) {
      logger.log(`[VirtualList] Items increased from ${lastCount} to ${currentItemsCount}, resetting loading state`);
      isHandlingRef.current = false;
      lastLoadTimeRef.current = Date.now();
    }
    
    lastItemsCountRef.current = currentItemsCount;
  }, [items.length, feedContextId]);

  // Главная логика IntersectionObserver
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const entry = entries[0];
    if (!entry || !onEndReached) return;

    if (entry.isIntersecting) {
      // ЗАЩИТА: Проверяем все условия перед вызовом
      if (loading || allLoaded || isHandlingRef.current) {
        logger.log(`[VirtualList] Intersection ignored: loading=${loading}, allLoaded=${allLoaded}, handling=${isHandlingRef.current}`);
        return;
      }

      // ИСПРАВЛЕНИЕ: Уменьшаем cooldown с 2000ms до 500ms для лучшего UX
      const now = Date.now();
      if (now - lastLoadTimeRef.current < 500) { // Уменьшаем с 2000 до 500ms
        logger.log(`[VirtualList] Intersection ignored: cooldown active (${500 - (now - lastLoadTimeRef.current)}ms remaining)`);
        return;
      }

      // ЗАЩИТА: Лимит для пустых лент
      if (items.length === 0 && (emptyLoadAttemptsRef.current || 0) > 2) {
        logger.log(`[VirtualList] Too many empty load attempts (${emptyLoadAttemptsRef.current}), stopping`);
        return;
      }

      logger.log(`[VirtualList] Intersection triggered loading`);
      isHandlingRef.current = true;
      lastLoadTimeRef.current = now;
      
      if (items.length === 0) {
        emptyLoadAttemptsRef.current = (emptyLoadAttemptsRef.current || 0) + 1;
      } else {
        emptyLoadAttemptsRef.current = 0; // Сбрасываем при успешной загрузке
      }

      try {
        onEndReached();
        
        // ИСПРАВЛЕНИЕ: Сбрасываем флаг обработки через меньший интервал
        setTimeout(() => {
          isHandlingRef.current = false;
        }, 100); // Уменьшаем задержку
      } catch (error) {
        logger.error(`[VirtualList] Error in onEndReached:`, error);
        isHandlingRef.current = false;
      }
    }
  }, [onEndReached, allLoaded, items, loading]);

  useEffect(() => {
    if (!enableManualModeTracking) return;
    
    const firstVisibleIndex = virtualItems[0]?.index ?? 0;
    
    // НЕ выключаем manual mode при скролле вверх если есть новые посты в буфере
    if (firstVisibleIndex > 0 && !manualMode) {
      logger.log('[VirtualList] User scrolled down, enabling manual update mode');
      onScrollDown?.();
    }
    // Убираем автоматическое выключение manual mode при скролле к топу
    // Теперь manual mode выключается ТОЛЬКО кнопкой "Load new posts"
  }, [virtualItems, manualMode, enableManualModeTracking, onScrollDown]);

  // Setup IntersectionObserver
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

  // ЯЛогика для определения состояний
  const hasItems = items.length > 0;
  const isInitialLoading = loading && !hasItems;
  const isLoadingMore = loading && hasItems;
  const isEmpty = !loading && !hasItems;
  
  // Показывать индикатор пагинации только когда есть элементы
  const shouldShowPaginationIndicator = hasItems;

  // Показать начальную загрузку (вместо списка)
  if (isInitialLoading) {
    const loadingContent = React.isValidElement(loadingIndicator) 
      ? loadingIndicator 
      : <LoadingIndicator 
          loading={true}
          allLoaded={false}
          hasItems={false}
          onVisible={() => {}}
          emptyMessage={loadingMessage || "Loading content..."}
        />;
        
    return (
      <div className="virtual-list-container-empty-state">
        {loadingContent}
      </div>
    );
  }

  // Показать пустое состояние (вместо списка)
  if (isEmpty) {
    const emptyContent = React.isValidElement(emptyComponent) 
      ? emptyComponent 
      : <Empty description={emptyMessage || "No content available"} />;
      
    return (
      <div className="virtual-list-container-empty-state">
        {emptyContent}
      </div>
    );
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
    hasItems,
    isInitialLoading,
    isLoadingMore,
    isEmpty,
    shouldShowPaginationIndicator,
    feedContextId,
    lastFeedContextId: lastFeedContextIdRef.current,
    ...(debugOptions || {})
  };

  return (
    <div className={`virtual-list-container ${className}`}>
      <div 
        ref={listRef}
        className="virtual-list-container-items"
        style={{
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
              className="virtual-list-container-item"
              style={{
                transform: `translateY(${topPosition}px)`
              }}
            >
              {renderItem(virtualItem, (el) => measureElement(el, virtualItem.index))}
            </div>
          );
        })}
      </div>
      
      {/* Индикатор пагинации - ВСЕГДА под списком когда есть элементы */}
      {shouldShowPaginationIndicator && (
        <div className="virtual-list-container-pagination-indicator">
          <div ref={sentinelRef} className="virtual-list-container-sentinel" />
          
          <LoadingIndicator 
            loading={isLoadingMore}
            allLoaded={allLoaded && !isLoadingMore}
            hasItems={true}
            onVisible={() => {}}
            emptyMessage="No more items"
            itemCount={items.length}
          />
        </div>
      )}
      
      {process.env.NODE_ENV === 'development' && <DebugInfo {...debugProps} />}
    </div>
  );
}

export default VirtualList;