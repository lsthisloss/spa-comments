import React, { useRef, useEffect, useCallback } from 'react';
import { Spin } from 'antd';
import { observer } from 'mobx-react-lite';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { DebugInfo } from '../ui/modals/DebugInfo';
import { logger } from '../../utils/Logger';
import { LoadingIndicator } from '../ui/particles/LoadingIndicator';

/*
  Типы пропсов для VirtualList
  - items: массив элементов для отображения
  - renderItem: функция для рендеринга каждого элемента
  - getItemKey: функция для получения уникального ключа элемента
  - estimateItemHeight: функция для оценки высоты элемента
  - onEndReached: функция, вызываемая при достижении конца списка
  - loading: флаг загрузки
  - emptyComponent: компонент для отображения при пустом списке
  - emptyMessage: сообщение для отображения при пустом списке
  - className: CSS класс для контейнера
  - allLoaded: флаг, указывающий, что все элементы загружены
  - debugOptions: опции для отладки
  - manualMode: флаг, указывающий на ручной режим загрузки
  - feedContextId: идентификатор контекста фида для отладки
*/

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey: (item: T) => string;
  estimateItemHeight: (item: T) => number;
  onEndReached?: () => void;
  loading?: boolean;
  emptyComponent?: React.ReactNode;
  emptyMessage?: string;
  className?: string;
  allLoaded?: boolean;
  debugOptions?: Record<string, unknown>;
  manualMode?: boolean;
  feedContextId?: string;
}

/*
  Компонент виртуального списка с поддержкой MobX и React Virtual
  - Использует tanstack/react-virtual для виртуализации
  - Поддерживает автоподгрузку, отложенную загрузку и ручной режим
  - Логирует изменения состояния и события
  - Поддерживает отладочную информацию
*/

const VirtualList = observer(<T extends Record<string, unknown>>(props: VirtualListProps<T>) => {
  const {
    items,
    renderItem,
    getItemKey,
    estimateItemHeight,
    onEndReached,
    loading = false,
    emptyMessage = 'No items found',
    className = '',
    allLoaded = false,
    debugOptions = {},
    manualMode = false,
    feedContextId = 'default',
  } = props;

  // Рефы для отслеживания состояния
  const renderCountRef = useRef(0);
  const prevItemsLengthRef = useRef(items.length);
  const prevLoadingRef = useRef(loading);
  const lastLoadTriggeredRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  
  /*
    Счетчик для принудительного обновления компонента
    - Используем useState для создания счетчика
    - Используем useCallback для мемоизации функции forceUpdate
  */
  const [forceUpdateCounter, setForceUpdateCounter] = React.useState(0);
  const forceUpdate = useCallback(() => {
    setForceUpdateCounter(prev => prev + 1);
    //logger.log('[VirtualList] Force update triggered');
  }, []);

  //  Кеш измеренных высот
  const measuredHeights = useRef(new Map<string, number>());

  const stableEstimateSize = useCallback((index: number) => {
    if (index < 0 || index >= items.length) {
      return 128;
    }

    const item = items[index];
    if (!item) {
      return 128;
    }

    try {
      const itemKey = getItemKey(item);

      //  кешированную высоту если есть
      if (measuredHeights.current.has(itemKey)) {
        return measuredHeights.current.get(itemKey)!;
      }

      const baseHeight = estimateItemHeight(item);

      // Проверяем наличие изображения
      const hasImage = item.imageUrl || item.fileName || item.fileUrl;

      let estimatedHeight;

      if (hasImage) {
        const content = typeof item.content === 'string' ? item.content : '';
        const textHeight = Math.max(40, content.length * 0.6);
        const headerHeight = 60;
        const imageMinHeight = 80;
        const imageMaxHeight = 240;
        const footerHeight = 50;
        const padding = 20;

        const imageHeight = Math.min(imageMaxHeight, Math.max(imageMinHeight, 120));
        estimatedHeight = headerHeight + imageHeight + textHeight + footerHeight + padding;
      } else {
        const content = item.content || '';
        if (typeof content === 'string' && content.length > 200) {
          estimatedHeight = Math.max(baseHeight, 180);
        } else {
          estimatedHeight = Math.max(baseHeight, 100);
        }
      }

      //  Округляем до целого числа
      estimatedHeight = Math.round(estimatedHeight);

      // КЕШИРУЕМ оценку СРАЗУ
      measuredHeights.current.set(itemKey, estimatedHeight);

      return estimatedHeight;
    } catch {
      return 128;
    }
  }, [items, estimateItemHeight, getItemKey]);

  /*
    Объект виртуализатора
    - Используем useWindowVirtualizer из tanstack/react-virtual
    - Передаем количество элементов, оценку размера и параметры оверскана
    - Устанавливаем scrollMargin в 0, чтобы избежать проблем с отступами
  */
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: stableEstimateSize,
    overscan: 5,
    scrollMargin: 0,
  });

  // Наконец получаем виртуализированные элементы 
  const virtualItems = virtualizer.getVirtualItems();

  /*
    Ссылки на предыдущие значения для логирования
    - prevItemsLengthRef: длина массива items
    - prevLoadingRef: состояние загрузки
    - loadingChanged: флаг, указывающий на изменение состояния загрузки
    - itemsChanged: флаг, указывающий на изменение длины массива items
    - renderCountRef: счетчик рендеров
  */

  const itemsChanged = items.length !== prevItemsLengthRef.current;
  const loadingChanged = loading !== prevLoadingRef.current;

  /*  Логика для отслеживания изменений
    - Если длина массива items изменилась, увеличиваем счетчик рендеров
    - Если состояние загрузки изменилось, обновляем prevLoadingRef
  */

  if (itemsChanged) {
    renderCountRef.current += 1;
    prevItemsLengthRef.current = items.length;
  }

  if (loadingChanged) {
    prevLoadingRef.current = loading;
  }
  // Мемоизация ключа элемента, чтобы избежать лишних вычислений
  const memoizedGetItemKey = useCallback((item: T) => {
    try {
      const key = getItemKey(item);
      return key || `fallback-${Date.now()}-${Math.random()}`;
    } catch (error) {
      return `error-${Date.now()}-${Math.random()}` + error;
    }
  }, [getItemKey]);

  /*
    Обработчик события изменения высоты
    - Используем useEffect для подписки на событие postsHeightRecalculation
    - Проверяем, что feedType совпадает с текущим контекстом
    - Если событие связано с новым комментарием или постом, очищаем кеш высот
    - Вызываем forceUpdate для перерисовки компонента
  */
  useEffect(() => {
    const handleHeightRecalculation = (event: CustomEvent) => {
      const { feedType, reason, addedCount } = event.detail;

      const currentFeedType = feedContextId?.split('-')[0];

      if (feedType !== currentFeedType) {
        logger.log(`[VirtualList] Ignoring height recalculation for ${feedType} (current: ${currentFeedType})`);
        return;
      }

      logger.log(`[VirtualList] Height recalculation requested for ${feedType}: ${reason} (+${addedCount} items)`);

      // Обрабатываем comments точно так же как feed/following
      if (reason === 'newComment' || reason === 'newPost') {
        // Очищаем кеш высот для новых элементов
        measuredHeights.current.clear();
      }

      forceUpdate();
      logger.log(`[VirtualList] Force update completed for ${feedType} (immediate)`);
    };

    window.addEventListener('postsHeightRecalculation', handleHeightRecalculation as EventListener);

    return () => {
      window.removeEventListener('postsHeightRecalculation', handleHeightRecalculation as EventListener);
    };
  }, [forceUpdate, feedContextId]);

  // Сброс флага загрузки при изменении состояния
  useEffect(() => {
    if (!loading) {
      isLoadingMoreRef.current = false;
    }
  }, [loading]);

  /*
    Обработчики событий для обновления состояния
    - bufferedPostsLoaded: просто логируем
    - newPost: делаем force update и скроллим вверх, если это текущий пользователь
    - appendNewItems: просто логируем, не делаем force update
  */
  useEffect(() => {
    const handleBufferedPostsLoaded = () => {
      logger.log('[VirtualList] Buffered posts loaded, maintaining scroll position');
    };

    const handleNewPost = (event: CustomEvent) => {
      // Force update при получении нового поста, иначе виртуальный список сломает размеры
      // Если это событие от текущего пользователя, то скроллим вверх
      forceUpdate();
      logger.log('[VirtualList] Force update triggered by new post');

      if (event.detail?.isCurrentUser) {
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }
    };

    const handleAppendNewItems = (event: CustomEvent) => {
      logger.log('[VirtualList] appendNewItems event received:', event.detail);
      // НЕ делаем force update для обычной подгрузки
    };
    /*
      Добавляем обработчики событий
      - Используем window.addEventListener для глобальных событий
      - Используем useEffect для очистки обработчиков при размонтировании компонента
    */
    window.addEventListener('bufferedPostsLoaded', handleBufferedPostsLoaded);
    window.addEventListener('newPost', handleNewPost as EventListener);
    window.addEventListener('appendNewItems', handleAppendNewItems as EventListener);

    return () => {
      window.removeEventListener('bufferedPostsLoaded', handleBufferedPostsLoaded);
      window.removeEventListener('newPost', handleNewPost as EventListener);
      window.removeEventListener('appendNewItems', handleAppendNewItems as EventListener);
    };
  }, [forceUpdate]);

  useEffect(() => {
    logger.log(`[VirtualList] Feed context changed to: ${feedContextId}`);
  }, [feedContextId]);


  /*
    Автоподгрузка при достижении конца списка
    - Проверяем, что onEndReached задан и не в ручном режиме
    - Проверяем, что есть элементы в списке
    - Проверяем, что пользователь близко к концу списка
    - Загружаем новые элементы, если прошло достаточно времени с последней загрузки
  */
  useEffect(() => {
    // Автоподгрузка работает независимо от manualMode LoadingIndicator
    if (!onEndReached || allLoaded || loading) {
      return;
    }

    // Если нет элементов - выходим
    if (virtualItems.length === 0 || items.length === 0) {
      return;
    }

    const lastVisibleIndex = virtualItems[virtualItems.length - 1].index;
    const totalItems = items.length;
    const remainingItems = totalItems - lastVisibleIndex - 1;

    // Загружаем только если пользователь близко к концу
    if (remainingItems < 10) {
      const now = Date.now();

      if (now - lastLoadTriggeredRef.current > 1000) {
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const isNearBottom = scrollY + windowHeight >= documentHeight - 500;

        if (isNearBottom) {
          lastLoadTriggeredRef.current = now;
          logger.log(`[VirtualList] Auto-load triggered: remaining=${remainingItems}${manualMode ? ' (manual mode)' : ''}`);
          onEndReached();
        }
      }
    }

  }, [virtualItems, items.length, onEndReached, allLoaded, loading, manualMode]);

  // Дебаг объект для отладки
  const debugProps = React.useMemo(() => {
    const firstIndex = virtualItems[0]?.index ?? -1;
    const lastIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;

    return {
      visibleRange: `${firstIndex}-${lastIndex}`,
      itemsCount: items.length,
      totalHeight: virtualizer.getTotalSize(),
      virtualItems: virtualItems.length,
      loading,
      allLoaded,
      manualMode,
      feedType: debugOptions.feedType || 'unknown',
      contextType: 'tanstack-render-based',
      feedKey: feedContextId,
      remainingItems: items.length - lastIndex - 1,
      renderCount: renderCountRef.current,
      isLoadingMore: isLoadingMoreRef.current,
      ...debugOptions,
    };
  }, [virtualItems, items.length, virtualizer, loading, allLoaded, manualMode, debugOptions, feedContextId]);

  // Ранний возврат для отладки
  if (loading && items.length === 0) {
    return (
      <div className={`virtual-list-container ${className}`} style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        width: '100%'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Spin size="large" />
          <span style={{ color: '#666', fontSize: '14px' }}>
            Loading feed...
          </span>
        </div>
      </div>
    );
  }


  // Основной рендер виртуального списка
  return (
    <div className={`virtual-list-container ${className}`} style={{ width: '100%' }}>
      <div
        key={forceUpdateCounter > 0 ? `newpost-${forceUpdateCounter}` : 'stable'}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];

          if (!item) {
            return (
              <div key={`error-${virtualItem.index}`} style={{ height: '150px', background: 'red' }}>
                Error: No item at index {virtualItem.index}
              </div>
            );
          }

          const key = memoizedGetItemKey(item);

          return (
            <div
              key={key}
              data-index={virtualItem.index}
              data-item-id={('id' in item ? String(item.id) : 'no-id')}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>

      <LoadingIndicator
        loading={loading}
        allLoaded={allLoaded}
        hasItems={items.length > 0}
        onVisible={onEndReached || (() => { })}
        itemCount={items.length}
        isListReady={!loading}
        itemType={debugOptions.feedType === 'comments' ? 'comments' : 'posts'}
        emptyMessage={emptyMessage}
        showRetryButton={false}
      />
      <DebugInfo {...debugProps} />
    </div>
  );
});

VirtualList.displayName = 'VirtualList';

export default VirtualList;