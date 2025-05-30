import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { VirtualListItem } from '../../common/VirtualList';
import userStore from '../../../services/stores/UserStore';

interface DebugInfoProps {
  itemsCount: number;
  virtualItems: VirtualListItem<unknown>[];
  loading: boolean;
  allLoaded: boolean;
  totalHeight: number;
  measuredItems: number;
  manualMode?: boolean;
  bufferSize?: number;
  newPostsCount?: number;
  currentPage?: number;
  totalPosts?: number;
  forceShow?: boolean;
}

export const DebugInfo: React.FC<DebugInfoProps> = observer(({
  itemsCount,
  virtualItems,
  loading,
  allLoaded,
  totalHeight,
  measuredItems,
  manualMode = false,
  bufferSize = 0,
  newPostsCount = 0,
  currentPage = 1,
  totalPosts = 0,
  forceShow = false,
}) => {
  // Состояние для видимости формы
  const [isVisible, setIsVisible] = useState(() => {
    const saved = localStorage.getItem('debugInfoVisible');
    return saved ? JSON.parse(saved) : false;
  });

  // Состояние для раскрытия формы
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('debugInfoExpanded');
    return saved ? JSON.parse(saved) : false;
  });

  // Состояние для позиции формы
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('debugInfoPosition');
    return saved
      ? JSON.parse(saved)
      : { top: window.innerHeight - 120, left: window.innerWidth - 340 };
  });

  // Состояние для перетаскивания
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const debugRef = useRef<HTMLDivElement>(null);

  // Проверяем, должен ли отображаться дебаг
  const user = userStore.user;
  const shouldShow = forceShow || (user?.settings?.debugMode ?? false);

  // Корректировка позиции при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev: { top: number; left: number }) => {
        const maxX = window.innerWidth - (debugRef.current?.offsetWidth || 340);
        const maxY = window.innerHeight - (debugRef.current?.offsetHeight || 120);
        return {
          left: Math.max(10, Math.min(prev.left, maxX)),
          top: Math.max(10, Math.min(prev.top, maxY)),
        };
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Сохранение состояний в localStorage
  useEffect(() => {
    localStorage.setItem('debugInfoVisible', JSON.stringify(isVisible));
  }, [isVisible]);

  useEffect(() => {
    localStorage.setItem('debugInfoExpanded', JSON.stringify(isExpanded));
  }, [isExpanded]);

  useEffect(() => {
    localStorage.setItem('debugInfoPosition', JSON.stringify(position));
  }, [position]);

  // Обработчики для мыши
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.left,
      y: e.clientY - position.top,
    });
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newLeft = e.clientX - dragStart.x;
      const newTop = e.clientY - dragStart.y;

      const maxX = window.innerWidth - (debugRef.current?.offsetWidth || 340);
      const maxY = window.innerHeight - (debugRef.current?.offsetHeight || 120);
      const boundedLeft = Math.max(10, Math.min(newLeft, maxX));
      const boundedTop = Math.max(10, Math.min(newTop, maxY));

      setPosition({ left: boundedLeft, top: boundedTop });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Обработчики для сенсорных устройств
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - position.left,
      y: touch.clientY - position.top,
    });
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging && e.touches.length > 0) {
      const touch = e.touches[0];
      const newLeft = touch.clientX - dragStart.x;
      const newTop = touch.clientY - dragStart.y;

      const maxX = window.innerWidth - (debugRef.current?.offsetWidth || 340);
      const maxY = window.innerHeight - (debugRef.current?.offsetHeight || 120);
      const boundedLeft = Math.max(10, Math.min(newLeft, maxX));
      const boundedTop = Math.max(10, Math.min(newTop, maxY));

      setPosition({ left: boundedLeft, top: boundedTop });
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragStart]);

  // Не показываем, если не включен режим дебага
  if (!shouldShow) {
    return null;
  }

  // Функции для кнопок
  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
  };

  if (!isVisible) {
    return (
      <button
        className="debug-info__open-button"
        onClick={() => setIsVisible(true)}
        title="Open debug panel"
      >
        🐛
      </button>
    );
  }

  return (
    <div
      ref={debugRef}
      className={`debug-info__container ${isDragging ? 'debug-info__container--dragging' : 'debug-info__container--normal'}`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        touchAction: isDragging ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      <div
        className="debug-info__header"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="debug-info__title-container">
          <span className="debug-info__emoji">🐛</span>
          <span className="debug-info__title">DEBUG</span>
        </div>

        <div className="debug-info__status-container">
          {!isExpanded && (
            <div className="debug-info__status">
              <span className={`debug-info__status-icon ${loading ? 'debug-info__status-icon--loading' : 'debug-info__status-icon--success'}`}>
                {loading ? '⏳' : '✓'}
              </span>
              <span>{itemsCount}</span>
            </div>
          )}
          <button
            className="debug-info__button"
            onClick={toggleExpanded}
            title={isExpanded ? 'Collapse debug panel' : 'Expand debug panel'}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
          <button
            className="debug-info__button debug-info__button--close"
            onClick={toggleVisibility}
            title="Close debug panel"
          >
            ✕
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="debug-info__content">
          <div className="debug-info__info-row">
            <span className="debug-info__label">Items:</span>
            <span className="debug-info__value">{itemsCount}</span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">Virtual:</span>
            <span className="debug-info__value">{virtualItems.length}</span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">Measured:</span>
            <span className="debug-info__value">{measuredItems}</span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">Loading:</span>
            <span className={`debug-info__value debug-info__value--loading ${loading ? 'yes' : 'no'}`}>
              {loading ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">Complete:</span>
            <span className={`debug-info__value debug-info__value--complete ${allLoaded ? 'yes' : 'no'}`}>
              {allLoaded ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">Manual:</span>
            <span className={`debug-info__value debug-info__value--manual ${manualMode ? 'on' : 'off'}`}>
              {manualMode ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">Buffer:</span>
            <span className={`debug-info__value debug-info__value--buffer ${bufferSize > 0 ? 'has-items' : 'no-items'}`}>
              {bufferSize}
            </span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">New:</span>
            <span className={`debug-info__value debug-info__value--new-posts ${newPostsCount > 0 ? 'has-new' : 'no-new'}`}>
              {newPostsCount}
            </span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">Page:</span>
            <span className="debug-info__value">{currentPage || 1}</span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">Total:</span>
            <span className="debug-info__value">{totalPosts || 0}</span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">Range:</span>
            <span className="debug-info__value">
              {virtualItems.length > 0
                ? `${virtualItems[0].index}-${virtualItems[virtualItems.length - 1].index}`
                : 'none'}
            </span>
          </div>
          <div className="debug-info__info-row">
            <span className="debug-info__label">Height:</span>
            <span className="debug-info__value">{totalHeight}px</span>
          </div>
        </div>
      )}
    </div>
  );
});