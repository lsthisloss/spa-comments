import React, { ReactNode, useEffect, useRef } from 'react';
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
  preserveData?: boolean;
  renderItem: (virtualItem: VirtualListItem<T>, measureRef: (el: HTMLElement | null) => void) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  totalHeight: number;
  virtualItems: VirtualListItem<T>[];
  measureElement: (el: HTMLElement | null, index: number) => void;
  onEndReached?: () => void;
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
    feedContextId,
    preserveData = false,
  } = props;

  // ФЛАГИ СОСТОЯНИЙ
  const isDataLoadedRef = useRef(false);           // Данные загружены
  const isRenderedRef = useRef(false);             // Элементы отрендерены  
  const isUserScrolledRef = useRef(false);         // Пользователь скроллил
  const canLoadMoreRef = useRef(false);            // Можно загружать еще
  const isLoadingRef = useRef(false);              // Идет загрузка
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Update the data preservation logic in the first useEffect
  
useEffect(() => {
  if (preserveData && isDataLoadedRef.current && virtualItems.length > 0 && !isRenderedRef.current) {
    logger.log(`[VirtualList] Virtual items ready after preservation, enabling scroll`);
    isRenderedRef.current = true;
    canLoadMoreRef.current = true;
  }
}, [preserveData, virtualItems.length]);

useEffect(() => {
  const wasEmpty = !isDataLoadedRef.current;
  const hasData = items.length > 0;

  // Check if we should preserve data
  if (preserveData && isDataLoadedRef.current && hasData) {
    logger.log(`[VirtualList] Preserving data, skipping reset (${items.length} items)`);
    
    // IMPORTANT: Restore proper state when preserving data
    if (!isRenderedRef.current && virtualItems.length > 0) {
      isRenderedRef.current = true;
      canLoadMoreRef.current = true;
      logger.log(`[VirtualList] PRESERVED: Restored rendered state and CAN_LOAD_MORE`);
    }
    
    return;
  }

  if (wasEmpty && hasData) {
    isDataLoadedRef.current = true;
    logger.log(`[VirtualList] DATA LOADED: ${items.length} items`);
  }

  if (!hasData) {
    isDataLoadedRef.current = false;
    isRenderedRef.current = false;
    isUserScrolledRef.current = false;
    canLoadMoreRef.current = false;
    isLoadingRef.current = false;

    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

    logger.log(`[VirtualList] DATA RESET`);
  }
}, [items.length, preserveData, virtualItems.length]);
  // 2. ОТСЛЕЖИВАНИЕ РЕНДЕРИНГА
  useEffect(() => {
    const hasData = isDataLoadedRef.current;
    const hasVirtual = virtualItems.length > 0;

    if (hasData && hasVirtual && !isRenderedRef.current) {
      isRenderedRef.current = true;

      // ЗАДЕРЖКА перед разрешением загрузки
      renderTimeoutRef.current = setTimeout(() => {
        canLoadMoreRef.current = true;
        logger.log(`[VirtualList] RENDERED: ${virtualItems.length} virtual items, CAN_LOAD_MORE enabled`);
      }, 1500); // 1.5 секунды задержка
    }

    return () => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    };
  }, [virtualItems.length]);


  useEffect(() => {
      if (!isRenderedRef.current) {
    logger.log(`[VirtualList] Skipping scroll detection - not rendered yet№`);
    return;
  }

    // Log current state for debugging
    logger.log(`[VirtualList] Scroll check: canLoadMore=${canLoadMoreRef.current}, isLoading=${isLoadingRef.current}, items=${items.length}, virtual=${virtualItems.length}`);


    // ПРОВЕРКА СОРТИРОВКИ
    const isSorting = debugOptions?.sortingInProgress === true;
    if (isSorting) {
      logger.log(`[VirtualList] LOADING BLOCKED: sorting in progress`);
      return; // БЛОКИРУЕМ ЗАГРУЗКУ ПРИ СОРТИРОВКЕ
    }

    // АНАЛИЗ ВИДИМОСТИ
    const firstVisible = virtualItems[0]?.index ?? 0;
    const lastVisible = virtualItems[virtualItems.length - 1]?.index ?? 0;
    const totalItems = items.length;
    const hasMoreOnServer = !allLoaded;

    const isAtEnd = lastVisible >= totalItems - 3; // Стандартная - когда до конца 3 элемента

    const allItemsVisible = virtualItems.length === totalItems && totalItems > 0;

    if (firstVisible > 0 && !isUserScrolledRef.current) {
      isUserScrolledRef.current = true;
    }

    if (
      // СТАНДАРТНЫЙ СЛУЧАЙ - СКРОЛЛ ДО КОНЦА
      (isAtEnd && hasMoreOnServer && canLoadMoreRef.current && !isLoadingRef.current) ||
      // НОВЫЙ СЛУЧАЙ - ВСЕ ЭЛЕМЕНТЫ ВИДНЫ, НО ЕСТЬ ЕЩЕ НА СЕРВЕРЕ
      (allItemsVisible && hasMoreOnServer && canLoadMoreRef.current && !isLoadingRef.current)
    ) {
      isLoadingRef.current = true;
      canLoadMoreRef.current = false;

      if (onEndReached) {
        logger.log(
          `[VirtualList] LOADING MORE: atEnd=${isAtEnd}, allVisible=${allItemsVisible}, ` +
          `totalItems=${totalItems}, visible=${lastVisible}`
        );
        onEndReached();
      }
    }

    if (enableManualModeTracking && !manualMode && onScrollDown && firstVisible > 0) {
      onScrollDown();
    }
  }, [virtualItems, items.length, allLoaded, onEndReached, enableManualModeTracking, manualMode, onScrollDown, debugOptions]);

  // 4. ОТСЛЕЖИВАНИЕ СОСТОЯНИЯ LOADING
  useEffect(() => {
    const wasLoading = isLoadingRef.current;
    const isCurrentlyLoading = loading;

    if (wasLoading && !isCurrentlyLoading) {
      // Загрузка завершена
      isLoadingRef.current = false;

      // Восстанавливаем возможность загрузки через 1 секунду
      loadTimeoutRef.current = setTimeout(() => {
        canLoadMoreRef.current = true;
        logger.log(`[VirtualList] LOADING COMPLETE: CAN_LOAD_MORE restored`);
      }, 1);
    }

    if (!wasLoading && isCurrentlyLoading) {
      isLoadingRef.current = true;
      logger.log(`[VirtualList] LOADING STARTED`);
    }

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [loading]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, []);

  // Логика состояний
  const hasItems = items.length > 0;
  const isInitialLoading = loading && !hasItems;
  const isLoadingMore = loading && hasItems;
  const isEmpty = !loading && !hasItems;
  const shouldShowPaginationIndicator = hasItems;

  // Показать начальную загрузку
  if (isInitialLoading) {
    const loadingContent = React.isValidElement(loadingIndicator)
      ? loadingIndicator
      : <LoadingIndicator
        loading={true}
        allLoaded={false}
        hasItems={false}
        onVisible={() => { }}
        emptyMessage={loadingMessage || "Loading content..."}
      />;

    return (
      <div className="virtual-list-container-empty-state">
        {loadingContent}
      </div>
    );
  }

  // Показать пустое состояние
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
    isDataLoaded: isDataLoadedRef.current,
    isRendered: isRenderedRef.current,
    canLoadMore: canLoadMoreRef.current,
    isLoading: isLoadingRef.current,
    userScrolled: isUserScrolledRef.current,
    manualMode,
    hasItems,
    isInitialLoading,
    isLoadingMore,
    isEmpty,
    shouldShowPaginationIndicator,
    feedContextId,
    ...(debugOptions || {})
  };

  return (
    <div className={`virtual-list-container ${className}`}>
      <div
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

      {/* Индикатор пагинации */}
      {shouldShowPaginationIndicator && (
        <div className="virtual-list-container-pagination-indicator">
          <LoadingIndicator
            loading={isLoadingMore}
            allLoaded={allLoaded && !isLoadingMore}
            hasItems={true}
            onVisible={() => { }}
            emptyMessage="No more items"
            itemCount={items.length}
          />
        </div>
      )}

      {<DebugInfo {...debugProps} />}
    </div>
  );
}

export default VirtualList;