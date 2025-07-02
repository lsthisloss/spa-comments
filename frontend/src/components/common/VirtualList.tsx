import { useRef, useEffect, useCallback, useMemo, useState, ReactNode } from 'react';
import { Spin } from 'antd';
import { observer } from 'mobx-react-lite';
import { debounce, useWindowVirtualizer } from '@tanstack/react-virtual';
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
  
  // Реф больше не нужен для window scroll

  /*
    Счетчик для принудительного обновления компонента
    - Используем useState для создания счетчика
    - Используем useCallback для мемоизации функции forceUpdate
  */
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  
  const forceUpdate = useCallback(() => {
    setForceUpdateCounter(prev => prev + 1);
    setDataVersion(prev => prev + 1);
    logger.log('[VirtualList] Force update triggered');
  }, []);

  const stableEstimateSize = useCallback((index: number) => {
    if (index < 0 || index >= items.length) {
      return 200; // Default fallback height
    }

    const item = items[index];
    if (!item) {
      return 200;
    }

    try {
      // Полностью доверяем TanStack Virtual's внутреннему кешированию
      // и используем только функцию оценки из хука
      const estimatedHeight = estimateItemHeight(item);
      
      // Логирование закомментировано для производительности
      // const itemKey = getItemKey(item);
      // console.log(`[VirtualList] Using hook estimation for ${itemKey}: ${estimatedHeight}px`);

      return estimatedHeight;
    } catch {
      return 128;
    }
  }, [items, estimateItemHeight, getItemKey]);

  /*
    Объект виртуализатора
    - Используем useWindowVirtualizer из tanstack/react-virtual
    - Передаем количество элементов, оценку размера и параметры оверскана
    - Работает со скроллом окна (window scroll)
    - Мемоизируем конфигурацию с dataVersion для принудительного пересоздания
  */
  
  // Мемоизируем конфигурацию virtualizer с зависимостью от dataVersion
  const virtualizerConfig = useMemo(() => {
    // Более консервативные значения overscan для лучшей производительности
    // Но достаточные, чтобы элементы не исчезали при скролле небольших списков
    let dynamicOverscan;
    if (items.length <= 10) {
      // Для очень маленьких списков можем позволить показать все
      dynamicOverscan = items.length;
    } else if (items.length <= 20) {
      // До 20 элементов - overscan 10 (половина от размера)
      dynamicOverscan = 10;
    } else if (items.length <= 50) {
      // До 50 элементов - overscan 8
      dynamicOverscan = 8;
    } else if (items.length <= 100) {
      // До 100 элементов - overscan 6
      dynamicOverscan = 6;
    } else {
      // Для больших списков - стандартный overscan для производительности
      dynamicOverscan = 5;
    }
    
    return {
      count: items.length,
      estimateSize: stableEstimateSize,
      overscan: dynamicOverscan,
    };
  }, [items.length, stableEstimateSize, dataVersion]);
  
  const virtualizer = useWindowVirtualizer(virtualizerConfig);

  // Наконец получаем виртуализированные элементы 
  const virtualItems = virtualizer.getVirtualItems();

  // Отладка виртуализированных элементов (закомментировано для производительности)
  /*useEffect(() => {
    const visibleItemIds = virtualItems.map((vi: any) => {
      const item = items[vi.index];
      return item && ('id' in item) ? String(item.id) : `index-${vi.index}`;
    });
    
    // Вычисляем overscan точно так же, как в конфигурации
    let overscanValue;
    if (items.length <= 10) {
      overscanValue = items.length;
    } else if (items.length <= 20) {
      overscanValue = 10;
    } else if (items.length <= 50) {
      overscanValue = 8;
    } else if (items.length <= 100) {
      overscanValue = 6;
    } else {
      overscanValue = 5;
    }
    
    console.log(`[VirtualList] Rendering ${virtualItems.length} virtual items (overscan: ${overscanValue}):`, {
      totalItems: items.length,
      visibleRange: virtualItems.length > 0 ? `${virtualItems[0].index}-${virtualItems[virtualItems.length - 1].index}` : 'none',
      visibleItemIds: visibleItemIds.slice(0, 5), // Показываем первые 5 ID
      firstItemId: items[0] && ('id' in items[0]) ? String(items[0].id) : 'no-first-item',
      forceUpdateCounter,
      overscan: overscanValue,
      listCategory: items.length <= 10 ? 'tiny' : items.length <= 20 ? 'small' : items.length <= 50 ? 'medium' : items.length <= 100 ? 'large' : 'huge'
    });
  }, [virtualItems, items.length, forceUpdateCounter]);*/

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

      // Только для новых элементов очищаем кеш - но НЕ весь кеш!
      if (reason === 'newComment' || reason === 'newPost') {
        // Вместо полной очистки кеша, просто принудительно обновляем компонент
        // TanStack Virtual сам пересчитает высоты по мере необходимости
        console.log(`[VirtualList] New ${reason} detected, triggering re-render without cache manipulation`);
      }

      // Просто обновляем компонент, позволяя TanStack Virtual делать свою работу
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
    - bufferedPostsLoaded: просто логируем, НЕ вмешиваемся в virtualizer
    - newPost: делаем force update, НЕ скроллим принудительно 
    - appendNewItems: просто логируем, не делаем force update
  */
  useEffect(() => {
    const handleBufferedPostsLoaded = () => {
      logger.log('[VirtualList] Buffered posts loaded, triggering force update for virtualizer recalculation');
      // ИСПРАВЛЕНИЕ: также вызываем forceUpdate для буферных постов
      // Иначе TanStack Virtual не пересчитает высоты после добавления постов извне
      forceUpdate();
    };

    const handleNewPost = () => {
      // Force update при получении нового поста для обновления состояния
      forceUpdate();
      logger.log('[VirtualList] Force update triggered by new post');

      // НЕ скроллим принудительно - пусть пользователь сам решает
      // TanStack Virtual правильно обработает изменения через forceUpdate
    };

    const handleAppendNewItems = () => {
      logger.log('[VirtualList] appendNewItems event received');
      // НЕ делаем force update для обычной подгрузки - TanStack Virtual
      // автоматически обновится когда данные изменятся через MobX
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

    // Создаем дебаунсированную функцию проверки и загрузки
    const checkAndLoadMore = debounce(window, () => {
      // Считаем оставшиеся элементы
      const remainingItems = items.length - (virtualItems[virtualItems.length - 1]?.index || 0) - 1;

      // Загружаем только если пользователь близко к концу
      if (remainingItems < 10) {
        const now = Date.now();

        if (now - lastLoadTriggeredRef.current > 1000) {
          // Проверяем позицию скролла окна
          const isNearBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 200;

          if (isNearBottom) {
            lastLoadTriggeredRef.current = now;
            logger.log(`[VirtualList] Auto-load triggered: remaining=${remainingItems}${manualMode ? ' (manual mode)' : ''}`);
            onEndReached();
          }
        }
      }
    }, 300);

    // Добавляем обработчик скролла к окну
    const handleScroll = () => checkAndLoadMore();
    window.addEventListener('scroll', handleScroll);

    // Очистка при размонтировании
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [virtualItems, items.length, onEndReached, allLoaded, loading, manualMode]);

  /*
    Отслеживание изменений в данных MobX
    - Когда изменяется количество элементов, обновляем dataVersion
    - Это заставляет virtualizer пересоздаться и правильно пересчитать все высоты
  */
  useEffect(() => {
    if (itemsChanged) {
      console.log(`[VirtualList] Items count changed: ${prevItemsLengthRef.current} -> ${items.length}, bumping dataVersion`);
      console.log(`[VirtualList] Current forceUpdateCounter: ${forceUpdateCounter}, will bump dataVersion`);
      setDataVersion(prev => prev + 1);
    }
  }, [items.length, itemsChanged, forceUpdateCounter]);

  // Дебаг объект для отладки
  const debugProps = useMemo(() => {
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
    <div 
      className={`virtual-list-container ${className}`} 
      style={{ 
        width: '100%',
        // Убираем фиксированную высоту и overflow для window scroll
      }}
    >
      <div
        key={forceUpdateCounter > 0 ? `newpost-${forceUpdateCounter}` : 'stable'}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem: any) => {
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