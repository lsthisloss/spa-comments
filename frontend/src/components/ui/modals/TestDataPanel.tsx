import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { message } from 'antd';
import { useUserStore } from '../../../hooks/useStore';
import { generateTestData, crashTestQueue } from "../../../utils/test-data-generator";

interface TestDataPanelProps {
  isVisible: boolean;
  onClose: () => void;
  parentPosition: { top: number; left: number };
}

export const TestDataPanel: React.FC<TestDataPanelProps> = observer(({
  isVisible,
  onClose,
  parentPosition
}) => {
  const [usersCount, setUsersCount] = useState(5);
  const [postsPerUser, setPostsPerUser] = useState(20);
  const [generateWithMedia, setGenerateWithMedia] = useState(true);
  const [crashTestExpanded, setCrashTestExpanded] = useState(false);
  const [crashUsersCount, setCrashUsersCount] = useState(3);
  const [crashPostsPerUser, setCrashPostsPerUser] = useState(50);

  const userStore = useUserStore();
  const canExecuteTests = userStore.canExecuteDebugTests;

  // Позиция рядом с родительской панелью
  const [position, setPosition] = useState(() => ({
    top: parentPosition.top,
    left: parentPosition.left + 360 // Смещение вправо
  }));

  // Обновляем позицию при изменении родительской позиции
  useEffect(() => {
    const newLeft = parentPosition.left + 360;
    const maxX = window.innerWidth - 340;
    const boundedLeft = Math.min(newLeft, maxX);
    
    setPosition({
      top: parentPosition.top,
      left: boundedLeft
    });
  }, [parentPosition]);

  // Refs для перетаскивания
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const currentPositionRef = useRef(position);
  const panelRef = useRef<HTMLDivElement>(null);

  // Обновляем ref при изменении позиции
  useEffect(() => {
    currentPositionRef.current = position;
  }, [position]);

  // Обработчики для перетаскивания (аналогично DebugInfo)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      requestAnimationFrame(() => {
        const newLeft = e.clientX - dragStartRef.current.x;
        const newTop = e.clientY - dragStartRef.current.y;

        const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 340);
        const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 600);

        const boundedLeft = Math.max(10, Math.min(newLeft, maxX));
        const boundedTop = Math.max(10, Math.min(newTop, maxY));

        if (panelRef.current) {
          panelRef.current.style.left = `${boundedLeft}px`;
          panelRef.current.style.top = `${boundedTop}px`;
          currentPositionRef.current = { left: boundedLeft, top: boundedTop };
        }
      });
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (panelRef.current) {
        panelRef.current.classList.remove('test-data-panel--dragging');
      }
      setPosition(currentPositionRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement &&
      e.target.closest('.test-data-panel__header') &&
      !e.target.closest('button')) {

      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX - currentPositionRef.current.left,
        y: e.clientY - currentPositionRef.current.top
      };

      if (panelRef.current) {
        panelRef.current.classList.add('test-data-panel--dragging');
      }

      e.preventDefault();
    }
  };

  // Обработчики форм (копируем из DebugInfo)
  const handleGenerateTestData = () => {
  if (usersCount < 1 || usersCount > 100) {
    message.error('Количество пользователей должно быть от 1 до 100');
    return;
  }

  if (postsPerUser < 1 || postsPerUser > 1000) {
    message.error('Количество постов на пользователя должно быть от 1 до 1000');
    return;
  }

  const totalMessages = usersCount * postsPerUser;

  if (totalMessages > 100000) {
    message.warning({
      content: `Вы пытаетесь создать ${totalMessages.toLocaleString()} сообщений. Это больше 100,000 и не имеет смысла для тестирования.`,
      duration: 8,
    });
    return;
  }

  if (totalMessages > 10000) {
    message.warning({
      content: `Будет создано ${totalMessages.toLocaleString()} сообщений. Это может занять некоторое время.`,
      duration: 4,
    });
  }

  message.info({
    content: `Генерируем ${usersCount} пользователей с ${postsPerUser} постами каждый (${totalMessages.toLocaleString()} сообщений)...`,
    duration: 3,
  });

  // Передаем только количество пользователей и постов (дополнительные опции не поддерживаются)
  generateTestData(usersCount, postsPerUser);
};

  const handleCrashTest = () => {
    if (crashUsersCount < 1 || crashUsersCount > 20) {
      message.error('Количество пользователей для краш-теста должно быть от 1 до 20');
      return;
    }

    if (crashPostsPerUser < 10 || crashPostsPerUser > 200) {
      message.error('Количество постов для краш-теста должно быть от 10 до 200');
      return;
    }

    const totalMessages = crashUsersCount * crashPostsPerUser;

    message.warning({
      content: `💥 CRASH TEST: Будет создано ${totalMessages} постов одновременно для перегрузки очереди!`,
      duration: 5,
    });

    crashTestQueue(crashUsersCount, crashPostsPerUser);
  };

  const handleUsersCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setUsersCount(Math.max(1, Math.min(100, value)));
  };

  const handlePostsPerUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setPostsPerUser(Math.max(1, Math.min(1000, value)));
  };

  const handleCrashUsersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setCrashUsersCount(Math.max(1, Math.min(20, value)));
  };

  const handleCrashPostsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setCrashPostsPerUser(Math.max(10, Math.min(200, value)));
  };

  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      className="test-data-panel"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 10001, // Выше основной панели
        touchAction: 'none'
      }}
    >
      {/* Header */}
      <div
        className="test-data-panel__header"
        style={{ cursor: 'grab' }}
        onMouseDown={handleMouseDown}
      >
        <div className="test-data-panel__title-container">
          <span className="test-data-panel__emoji">🧪</span>
          <span className="test-data-panel__title">TEST DATA</span>
        </div>

        <div className="test-data-panel__controls">
          <button
            className="test-data-panel__button test-data-panel__button--close"
            onClick={onClose}
            title="Close test data panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="test-data-panel__content">
        {canExecuteTests ? (
          <>
            <div className="form-group">
              <label htmlFor="testUsersCount">Users (1-100):</label>
              <input
                id="testUsersCount"
                type="number"
                value={usersCount}
                onChange={handleUsersCountChange}
                min={1}
                max={100}
                className={usersCount < 1 || usersCount > 100 ? 'error' : ''}
              />
              {(usersCount < 1 || usersCount > 100) && (
                <div className="error-message">
                  ⚠️ Должно быть от 1 до 100
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="testPostsPerUser">Posts per User (1-1000):</label>
              <input
                id="testPostsPerUser"
                type="number"
                value={postsPerUser}
                onChange={handlePostsPerUserChange}
                min={1}
                max={1000}
                className={postsPerUser < 1 || postsPerUser > 1000 ? 'error' : ''}
              />
              {(postsPerUser < 1 || postsPerUser > 1000) && (
                <div className="error-message">
                  ⚠️ Должно быть от 1 до 1000
                </div>
              )}
            </div>

            <div className="checkbox-group">
              <label className={`checkbox-label ${generateWithMedia ? 'active media-active' : ''}`}>
                <input
                  type="checkbox"
                  checked={generateWithMedia}
                  onChange={(e) => setGenerateWithMedia(e.target.checked)}
                />
                <div className="checkbox-content">
                  <div className="checkbox-title">
                    🖼️ Include images and files in posts
                  </div>
                  <div className="checkbox-description">
                    Adds visual content to test posts
                  </div>
                </div>
              </label>
            </div>


            <div className="info-panel">
              📊 Estimated: ~{generateWithMedia ? '30%' : '0%'} posts with images, ~{generateWithMedia ? '15%' : '0%'} with TXT files
            </div>

            <div className="total-counter">
              📈 Total messages: <strong>{(usersCount * postsPerUser).toLocaleString()}</strong>
            </div>

            <button
              onClick={handleGenerateTestData}
              className={`generate-button ${
                usersCount >= 1 && usersCount <= 100 && postsPerUser >= 1 && postsPerUser <= 1000
                  ? 'enabled'
                  : 'disabled'
              }`}
              disabled={usersCount < 1 || usersCount > 100 || postsPerUser < 1 || postsPerUser > 1000}
            >
              ✨ Generate Test Data
            </button>

            <div className="test-data-panel__crash-test">
              <div className="crash-header">
                <button
                  className="crash-toggle"
                  onClick={() => setCrashTestExpanded(v => !v)}
                >
                  💥 CRASH TEST QUEUE {crashTestExpanded ? '▲' : '▼'}
                </button>
              </div>

              {crashTestExpanded && (
                <>
                  <div className="crash-form">
                    <div className="form-group">
                      <label htmlFor="testCrashUsersCount">Users (1-20):</label>
                      <input
                        id="testCrashUsersCount"
                        type="number"
                        value={crashUsersCount}
                        onChange={handleCrashUsersChange}
                        min={1}
                        max={20}
                        className={crashUsersCount < 1 || crashUsersCount > 20 ? 'error' : ''}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="testCrashPostsPerUser">Posts per User (10-200):</label>
                      <input
                        id="testCrashPostsPerUser"
                        type="number"
                        value={crashPostsPerUser}
                        onChange={handleCrashPostsChange}
                        min={10}
                        max={200}
                        className={crashPostsPerUser < 10 || crashPostsPerUser > 200 ? 'error' : ''}
                      />
                    </div>
                  </div>

                  <div className="crash-counter">
                    💥 Total crash load: <span className="crash-total">{(crashUsersCount * crashPostsPerUser).toLocaleString()}</span> posts
                  </div>

                  <div className="rate-limit-info">
                    Rate limit: 10/min per user → {Math.max(0, crashPostsPerUser - 10)} posts will be queued per user
                  </div>

                  <button
                    onClick={handleCrashTest}
                    className="crash-button"
                    disabled={crashUsersCount < 1 || crashUsersCount > 20 || crashPostsPerUser < 10 || crashPostsPerUser > 200}
                  >
                    💥 START CRASH TEST
                  </button>

                </>
              )}
            </div>
          </>
        ) : (
          <div className="test-data-panel__restricted">
            <div className="restricted-icon">
              <span className="icon">🔒</span>
              <span className="title">ACCESS RESTRICTED</span>
            </div>
            <div className="restricted-message">
              Test data generation and crash testing are limited to administrators only
            </div>
            <div className="restricted-contact">
              Contact your system administrator for access
            </div>
          </div>
        )}
      </div>
    </div>
  );
});