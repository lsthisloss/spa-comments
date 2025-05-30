import { useRef, useCallback, useEffect, useState } from 'react';
import { VirtualListItem } from '../components/common/VirtualList';

// Constants for virtualization
const BUFFER_SIZE = 4; // Buffer items above and below viewport
const VISIBLE_ITEMS = 10; // Number of visible items
const TOTAL_POOL_SIZE = VISIBLE_ITEMS + BUFFER_SIZE * 2;

export function useVirtualItems<T>(
  items: T[], 
  getItemKey: (item: T, index: number) => string,
  estimateItemHeight: (item: T) => number
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [totalHeight, setTotalHeight] = useState(0);
  const itemHeightsRef = useRef<Map<number, number>>(new Map());
  const forceUpdateRef = useRef(0);
  const [forceUpdate, setForceUpdate] = useState(0);
  const imageLoadedRef = useRef<Set<string>>(new Set());

// Оптимизируем обработчик скролла с использованием requestAnimationFrame
useEffect(() => {
  let ticking = false;
  let lastKnownScrollPosition = 0;
  
  const handleScroll = () => {
    lastKnownScrollPosition = window.scrollY;
    
    if (!ticking) {
      window.requestAnimationFrame(() => {
        setScrollTop(lastKnownScrollPosition);
        ticking = false;
      });
      
      ticking = true;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

  // Clear cache when items change significantly
  useEffect(() => {
    const currentKeys = new Set(items.map((item, index) => getItemKey(item, index)));
    
    // If we have new items, clear outdated cache entries
    for (const [index] of itemHeightsRef.current) {
      if (index >= items.length || !currentKeys.has(getItemKey(items[index], index))) {
        itemHeightsRef.current.delete(index);
      }
    }
  }, [items, getItemKey]);

  // Get item height (measured or estimated)
  const getItemHeight = useCallback(
    (index: number) => {
      const measuredHeight = itemHeightsRef.current.get(index);
      if (measuredHeight) return measuredHeight;

      const item = items[index];
      return item ? estimateItemHeight(item) : 150;
    },
    [items, estimateItemHeight]
  );

  // Calculate item position based on heights of previous items
  const getItemPosition = useCallback(
    (index: number) => {
      let position = 0;
      for (let i = 0; i < index; i++) {
        position += getItemHeight(i);
      }
      return position;
    },
    [getItemHeight]
  );

  const findStartIndex = useCallback(() => {
    // Если scrollTop = 0, всегда начинаем с первого элемента
    if (scrollTop <= 10) return 0;

    let currentPosition = 0;
    for (let i = 0; i < items.length; i++) {
      const itemHeight = getItemHeight(i);
      if (currentPosition + itemHeight > scrollTop - (BUFFER_SIZE * 100)) {
        // Увеличиваем буферную зону выше текущей позиции
        return Math.max(0, i - BUFFER_SIZE);
      }
      currentPosition += itemHeight;
    }
    return Math.max(0, items.length - TOTAL_POOL_SIZE);
  }, [scrollTop, items.length, getItemHeight]);

  // И улучшим getVirtualItems
  const getVirtualItems = useCallback(() => {
    const startIndex = findStartIndex();
    const result: VirtualListItem<T>[] = [];
    
    // Всегда показываем минимум TOTAL_POOL_SIZE элементов, если они есть
    const itemsToShow = Math.min(TOTAL_POOL_SIZE, items.length);
    
    // Убедимся, что мы не выходим за границы массива
    const adjustedStartIndex = Math.min(startIndex, Math.max(0, items.length - itemsToShow));
    
    for (let i = 0; i < itemsToShow; i++) {
      const itemIndex = adjustedStartIndex + i;
      if (itemIndex < items.length) {
        const item = items[itemIndex];
        const height = getItemHeight(itemIndex);
        const position = getItemPosition(itemIndex);
        
        result.push({
          index: itemIndex,
          item,
          position,
          height,
          key: getItemKey(item, itemIndex),
          start: position,
          end: position + height,
          size: height,
          lane: 0,
        });
      }
    }
    
    return result;
  }, [items, findStartIndex, getItemHeight, getItemPosition, getItemKey]);

  const virtualItems = getVirtualItems();

  // Measure element and update its height
  const measureElement = useCallback(
    (element: HTMLElement | null, index: number) => {
      if (element && index < items.length) {
        const height = element.offsetHeight;
        if (height > 0) {
          const previousHeight = itemHeightsRef.current.get(index);
          
          if (previousHeight !== height) {
            itemHeightsRef.current.set(index, height);
            
            // Always trigger update for significant height changes
            if (!previousHeight || Math.abs(previousHeight - height) > 5) {
              forceUpdateRef.current += 1;
              setForceUpdate(forceUpdateRef.current);
              
              // Recalculate total height
              setTimeout(() => {
                const newTotalHeight = items.reduce((total, _, idx) => {
                  return total + getItemHeight(idx);
                }, 0);
                
                setTotalHeight(newTotalHeight);
              }, 0);
            }
          }
        }
      }
    },
    [items, getItemHeight]
  );

  // Handle image load events to trigger remeasurement
  const handleImageLoad = useCallback((itemKey: string, index: number) => {
    if (!imageLoadedRef.current.has(itemKey)) {
      imageLoadedRef.current.add(itemKey);
      
      // Force remeasurement after image loads
      setTimeout(() => {
        const element = document.querySelector(`[data-virtual-index="${index}"]`) as HTMLElement;
        if (element) {
          measureElement(element, index);
        }
      }, 50); // Small delay to ensure image is rendered
    }
  }, [measureElement]);

  // Calculate initial total height
  useEffect(() => {
    const initialTotalHeight = items.reduce((total, _, index) => {
      return total + getItemHeight(index);
    }, 0);
    
    setTotalHeight(initialTotalHeight);
  }, [items, getItemHeight]);

  // Force remeasurement when new items are added (like new posts)
  useEffect(() => {
    if (items.length > 0) {
      // Clear image loaded cache for new items
      const currentKeys = new Set(items.map((item, index) => getItemKey(item, index)));
      const loadedKeys = Array.from(imageLoadedRef.current);
      
      for (const key of loadedKeys) {
        if (!currentKeys.has(key)) {
          imageLoadedRef.current.delete(key);
        }
      }

      // Force update for the first few items (most likely to be new)
      setTimeout(() => {
        for (let i = 0; i < Math.min(3, items.length); i++) {
          const element = document.querySelector(`[data-virtual-index="${i}"]`) as HTMLElement;
          if (element) {
            measureElement(element, i);
          }
        }
      }, 100);
    }
  }, [items.length, measureElement, getItemKey, items]);

  return {
    virtualItems,
    totalHeight,
    scrollTop,
    measureElement,
    handleImageLoad,
    forceUpdate,
  };
}