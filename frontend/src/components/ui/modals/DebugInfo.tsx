import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { VirtualListItem } from '../../common/VirtualList';
import userStore from '../../../services/stores/UserStore';
import { generateTestData } from '../../../tests/test-post';

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
  const [testGenExpanded, setTestGenExpanded] = useState(false);
  const [usersCount, setUsersCount] = useState(5);
  const [postsPerUser, setPostsPerUser] = useState(20);

  const handleGenerateTestData = () => {
    generateTestData(usersCount, postsPerUser);
  };

  // Состояние для раскрытия формы
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('debugInfoExpanded');
    return saved ? JSON.parse(saved) : false;
  });

  // Состояние для позиции формы - начальная позиция
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('debugInfoPosition');
      return saved
        ? JSON.parse(saved)
        : { top: window.innerHeight - 120, left: window.innerWidth - 340 };
    } catch {
      return { top: window.innerHeight - 120, left: window.innerWidth - 340 };
    }
  });

  // Используем refs для отслеживания состояния перетаскивания
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const currentPositionRef = useRef(position);
  const debugRef = useRef<HTMLDivElement>(null);

  // Обновляем ref при изменении позиции через state
  useEffect(() => {
    currentPositionRef.current = position;
  }, [position]);

  // Проверяем, должен ли отображаться дебаг
  const user = userStore.user;
  const shouldShow = forceShow || (user?.settings?.debugMode ?? false);

  // Корректировка позиции при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      const maxX = window.innerWidth - (debugRef.current?.offsetWidth || 340);
      const maxY = window.innerHeight - (debugRef.current?.offsetHeight || 120);
      
      const newPosition = {
        left: Math.max(10, Math.min(currentPositionRef.current.left, maxX)),
        top: Math.max(10, Math.min(currentPositionRef.current.top, maxY)),
      };
      
      // Обновляем DOM напрямую для лучшей производительности
      if (debugRef.current) {
        debugRef.current.style.left = `${newPosition.left}px`;
        debugRef.current.style.top = `${newPosition.top}px`;
      }
      
      currentPositionRef.current = newPosition;
      setPosition(newPosition);
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
    try {
      localStorage.setItem('debugInfoPosition', JSON.stringify(position));
    } catch (e) {
      console.error('Failed to save position to localStorage', e);
    }
  }, [position]);

  // Настраиваем обработчики для перетаскивания
  useEffect(() => {
    // Обработчик движения мыши
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      // Используем requestAnimationFrame для плавного обновления
      requestAnimationFrame(() => {
        const newLeft = e.clientX - dragStartRef.current.x;
        const newTop = e.clientY - dragStartRef.current.y;
        
        const maxX = window.innerWidth - (debugRef.current?.offsetWidth || 340);
        const maxY = window.innerHeight - (debugRef.current?.offsetHeight || 120);
        
        const boundedLeft = Math.max(10, Math.min(newLeft, maxX));
        const boundedTop = Math.max(10, Math.min(newTop, maxY));
        
        // Обновляем DOM напрямую вместо обновления состояния React
        if (debugRef.current) {
          debugRef.current.style.left = `${boundedLeft}px`;
          debugRef.current.style.top = `${boundedTop}px`;
          
          // Сохраняем текущую позицию в ref
          currentPositionRef.current = { left: boundedLeft, top: boundedTop };
        }
      });
    };

    // Обработчик отпускания мыши
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      
      isDraggingRef.current = false;
      
      if (debugRef.current) {
        debugRef.current.classList.remove('debug-info__container--dragging');
      }
      
      // Обновляем React state только в конце перетаскивания
      setPosition(currentPositionRef.current);
    };

    // Обработчик движения на сенсорных устройствах
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length === 0) return;
      
      if (e.cancelable) {
        e.preventDefault();
      }
      
      requestAnimationFrame(() => {
        const touch = e.touches[0];
        const newLeft = touch.clientX - dragStartRef.current.x;
        const newTop = touch.clientY - dragStartRef.current.y;
        
        const maxX = window.innerWidth - (debugRef.current?.offsetWidth || 340);
        const maxY = window.innerHeight - (debugRef.current?.offsetHeight || 120);
        
        const boundedLeft = Math.max(10, Math.min(newLeft, maxX));
        const boundedTop = Math.max(10, Math.min(newTop, maxY));
        
        if (debugRef.current) {
          debugRef.current.style.left = `${boundedLeft}px`;
          debugRef.current.style.top = `${boundedTop}px`;
          
          currentPositionRef.current = { left: boundedLeft, top: boundedTop };
        }
      });
    };

    // Обработчик окончания касания
    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return;
      
      isDraggingRef.current = false;
      
      if (debugRef.current) {
        debugRef.current.classList.remove('debug-info__container--dragging');
      }
      
      setPosition(currentPositionRef.current);
    };

    // Устанавливаем обработчики один раз
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []); // Пустой массив зависимостей - обработчики создаются только один раз

  // Обработчики начала перетаскивания
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && 
        e.target.closest('.debug-info__header') && 
        !e.target.closest('button')) {
      
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX - currentPositionRef.current.left,
        y: e.clientY - currentPositionRef.current.top
      };
      
      if (debugRef.current) {
        debugRef.current.classList.add('debug-info__container--dragging');
      }
      
      e.preventDefault();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.target instanceof HTMLElement && 
        e.target.closest('.debug-info__header') && 
        !e.target.closest('button')) {
      
      const touch = e.touches[0];
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: touch.clientX - currentPositionRef.current.left,
        y: touch.clientY - currentPositionRef.current.top
      };
      
      if (debugRef.current) {
        debugRef.current.classList.add('debug-info__container--dragging');
      }
    }
  };

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
      className="debug-info__container"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 10000,
        touchAction: 'none'
      }}
    >
      {/* Header */}
      <div
        className="debug-info__header"
        style={{ cursor: 'grab' }}
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
          {/* content remains the same */}
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
          <div className="debug-info__test-data">
            <button
              className="debug-info__button"
              style={{ marginBottom: 8 }}
              onClick={() => setTestGenExpanded(v => !v)}
            >
              Generate Test Data {testGenExpanded ? '▲' : '▼'}
            </button>
            {testGenExpanded && (
              <div style={{ marginTop: 8 }}>
                <div>
                  <label htmlFor="usersCount">Users:</label>
                  <input
                    id="usersCount"
                    type="number"
                    value={usersCount}
                    onChange={(e) => setUsersCount(Number(e.target.value))}
                    min={1}
                    max={100}
                  />
                </div>
                <div>
                  <label htmlFor="postsPerUser">Posts per User:</label>
                  <input
                    id="postsPerUser"
                    type="number"
                    value={postsPerUser}
                    onChange={(e) => setPostsPerUser(Number(e.target.value))}
                    min={1}
                    max={50}
                  />
                </div>
                <button onClick={handleGenerateTestData} style={{ marginTop: 8 }}>
                  Generate
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});