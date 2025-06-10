import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { message } from 'antd';
import { useUserStore } from '../../../hooks/useStore';
import { generateTestData, stopCrashTest } from "../../../utils/test/test-data-generator";
import { highLoadTestManager, HighLoadTestConfig, HighLoadTestStats } from '../../../utils/test/high-load-test';

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
  const [isHighLoadMode, setIsHighLoadMode] = useState(false);
  
  // High Load параметры
  const [concurrentUsers, setConcurrentUsers] = useState(10);
  const [highLoadStats, setHighLoadStats] = useState<HighLoadTestStats | null>(null);
  
  // Состояние выполнения
  const [isTestRunning, setIsTestRunning] = useState(false);

  const userStore = useUserStore();
  const canExecuteTests = userStore.canExecuteDebugTests;

  // Позиционирование панели
  const [position, setPosition] = useState<{ top: number; left: number }>(() => {
    try {
      const saved = localStorage.getItem('testDataPanelPosition');
      return saved 
        ? JSON.parse(saved) 
        : { top: Math.max(100, parentPosition.top), left: Math.max(100, parentPosition.left + 360) };
    } catch {
      return { top: Math.max(100, parentPosition.top), left: Math.max(100, parentPosition.left + 360) };
    }
  });

  // Сохранение позиции в localStorage
  useEffect(() => {
    try {
      localStorage.setItem('testDataPanelPosition', JSON.stringify(position));
    } catch (e) {
      console.error('Failed to save position to localStorage', e);
    }
  }, [position]);

  // Ссылки для перетаскивания
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const currentPositionRef = useRef(position);
  const panelRef = useRef<HTMLDivElement>(null);

  // Обновляем ref при изменении позиции через state
  useEffect(() => {
    currentPositionRef.current = position;
  }, [position]);

  // Настройка перетаскивания
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      requestAnimationFrame(() => {
        const newLeft = e.clientX - dragStartRef.current.x;
        const newTop = e.clientY - dragStartRef.current.y;

        const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 340);
        const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 400);

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

  // Единый обработчик для запуска/остановки теста
  const handleTestAction = () => {
    if (isTestRunning) {
      // Остановка теста
      message.info({
        content: `⚠️ Остановка теста...`,
        duration: 2,
      });
      
      if (isHighLoadMode) {
        highLoadTestManager.stopTest();
      } else {
        stopCrashTest();
      }
      
      setIsTestRunning(false);
      return;
    }

    // Проверка валидности данных
    if (usersCount < 1 || usersCount > (isHighLoadMode ? 100000 : 100)) {
      message.error(`Количество пользователей должно быть от 1 до ${isHighLoadMode ? '100000' : '100'}`);
      return;
    }

    if (postsPerUser < 1 || postsPerUser > 1000) {
      message.error(`Количество постов на пользователя должно быть от 1 до 1000`);
      return;
    }

    const totalMessages = usersCount * postsPerUser;

    if (!isHighLoadMode && totalMessages > 100000) {
      message.warning({
        content: `Вы пытаетесь создать ${totalMessages.toLocaleString()} сообщений. Это больше 100000 и не имеет смысла для обычного тестирования.`,
        duration: 8,
      });
      return;
    }

    setIsTestRunning(true);
    setHighLoadStats(null);

    if (isHighLoadMode) {
      // Запуск High Load теста
      message.warning({
        content: `🚀 HIGH LOAD: Запускается тест с ${usersCount} пользователями × ${postsPerUser} постов = ${totalMessages.toLocaleString()} сообщений!`,
        duration: 5,
      });

      // Настраиваем конфигурацию теста
      const testConfig: Partial<HighLoadTestConfig> = {
        totalUsers: usersCount,
        postsPerUser,
        withMedia: generateWithMedia,
        concurrentUsers,
        testMode: 'normal'
      };

      // Запускаем тест и обрабатываем результаты
      highLoadTestManager.startTest(testConfig)
        .then((stats) => {
          setHighLoadStats(stats);
          message.success(`High Load тест завершен: ${stats.users.created} пользователей, ${stats.posts.created + stats.posts.queued} постов`);
        })
        .catch((error) => {
          message.error(`Ошибка при выполнении High Load теста: ${error.message}`);
        })
        .finally(() => {
          setIsTestRunning(false);
        });
    } else {
      // Запуск обычного теста
      const mediaInfo = generateWithMedia ? 'с изображениями и файлами' : 'только текст';
      
      message.info({
        content: `Генерируем ${usersCount} пользователей с ${postsPerUser} постами каждый (${totalMessages.toLocaleString()} сообщений, ${mediaInfo})...`,
        duration: 3,
      });

      generateTestData(usersCount, postsPerUser, true, generateWithMedia)
        .finally(() => {
          setIsTestRunning(false);
        });
    }
  };

  // Обработчики изменения полей
  const handleUsersCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    const maxUsers = isHighLoadMode ? 100000 : 100;
    setUsersCount(Math.max(1, Math.min(maxUsers, value)));
  };

  const handlePostsPerUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setPostsPerUser(Math.max(1, Math.min(1000, value)));
  };

  const handleConcurrentUsersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setConcurrentUsers(Math.max(1, Math.min(50, value)));
  };

  // Если панель не видима, не рендерим ее
  if (!isVisible) return null;

  // Расчет общего количества сообщений
  const totalMessages = usersCount * postsPerUser;

  // Получаем границы проверки в зависимости от режима
  const maxUsers = isHighLoadMode ? 100000 : 100;

  // Проверка валидности данных для кнопки
  const isDataValid = 
    usersCount >= 1 && 
    usersCount <= maxUsers && 
    postsPerUser >= 1 && 
    postsPerUser <= 1000 &&
    (!isHighLoadMode || (concurrentUsers >= 1 && concurrentUsers <= 50));

  return (
    <div
      ref={panelRef}
      className="test-data-panel"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 10001
      }}
    >
      {/* Header */}
      <div
        className="test-data-panel__header"
        onMouseDown={handleMouseDown}
      >
        <div className="test-data-panel__title-container">
          <span className="test-data-panel__emoji">{isHighLoadMode ? '🚀' : '🧪'}</span>
          <span className="test-data-panel__title">TEST DATA GENERATOR</span>
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
            {/* Переключатель режимов */}
            <div className="test-data-panel__mode-selector">
              <button 
                className={`mode-button ${!isHighLoadMode ? 'active' : ''}`}
                onClick={() => setIsHighLoadMode(false)}
                disabled={isTestRunning}
              >
                🧪 Regular Mode
              </button>
              <button 
                className={`mode-button ${isHighLoadMode ? 'active' : ''}`}
                onClick={() => setIsHighLoadMode(true)}
                disabled={isTestRunning}
              >
                🚀 High Load Mode
              </button>
            </div>

            {/* Настройки генерации данных */}
            <div className="test-data-panel__settings">
              {/* Настройка пользователей */}
              <div className="form-group">
                <label htmlFor="testUsersCount">
                  Users ({isHighLoadMode ? '1-100000' : '1-100'}):
                </label>
                <input
                  id="testUsersCount"
                  type="number"
                  value={usersCount}
                  onChange={handleUsersCountChange}
                  min={1}
                  max={maxUsers}
                  className={usersCount < 1 || usersCount > maxUsers ? 'error' : ''}
                  disabled={isTestRunning}
                />
                {(usersCount < 1 || usersCount > maxUsers) && (
                  <div className="error-message">
                    ⚠️ Должно быть от 1 до {maxUsers}
                  </div>
                )}
              </div>

              {/* Настройка постов */}
              <div className="form-group">
                <label htmlFor="testPostsPerUser">
                  Posts per User (1-1000):
                </label>
                <input
                  id="testPostsPerUser"
                  type="number"
                  value={postsPerUser}
                  onChange={handlePostsPerUserChange}
                  min={1}
                  max={1000}
                  className={postsPerUser < 1 || postsPerUser > 1000 ? 'error' : ''}
                  disabled={isTestRunning}
                />
                {(postsPerUser < 1 || postsPerUser > 1000) && (
                  <div className="error-message">
                    ⚠️ Должно быть от 1 до 1000
                  </div>
                )}
              </div>

              {/* Настройка одновременных пользователей для High Load */}
              {isHighLoadMode && (
                <div className="form-group">
                  <label htmlFor="concurrentUsers">
                    Concurrent Users (1-50):
                  </label>
                  <input
                    id="concurrentUsers"
                    type="number"
                    value={concurrentUsers}
                    onChange={handleConcurrentUsersChange}
                    min={1}
                    max={50}
                    className={concurrentUsers < 1 || concurrentUsers > 50 ? 'error' : ''}
                    disabled={isTestRunning}
                  />
                  {(concurrentUsers < 1 || concurrentUsers > 50) && (
                    <div className="error-message">
                      ⚠️ Должно быть от 1 до 50
                    </div>
                  )}
                </div>
              )}

              {/* Чекбокс для медиа */}
              <div className="checkbox-group">
                <label className={`checkbox-label ${generateWithMedia ? 'active media-active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={generateWithMedia}
                    onChange={(e) => setGenerateWithMedia(e.target.checked)}
                    disabled={isTestRunning}
                  />
                  <div className="checkbox-content">
                    <div className="checkbox-title">
                      🖼️ Include images and files in posts
                    </div>
                    <div className="checkbox-description">
                      Adds visual content to test posts (~30% with images)
                    </div>
                  </div>
                </label>
              </div>

              {/* Счетчик сообщений */}
              <div className="total-counter">
                {isHighLoadMode ? '🚀' : '📈'} Total messages: 
                <span>
                  <strong> {totalMessages.toLocaleString()}</strong>
                </span>
              </div>

              {/* Информация о High Load режиме */}
              {isHighLoadMode && (
                <div className="info-panel">
                  High Load режим: одновременно создаётся до {concurrentUsers} пользователей, 
                  каждый генерирует до {postsPerUser} постов.
                </div>
              )}

              {/* Кнопка запуска/остановки */}
              {isTestRunning ? (
                <button
                  onClick={handleTestAction}
                  className="generate-button test-button--stop"
                  style={{
                    animation: 'pulse 1s infinite'
                  }}
                >
                  ⚠️ STOP TEST
                </button>
              ) : (
                <button
                  onClick={handleTestAction}
                  className={`generate-button ${isDataValid ? 'enabled' : 'disabled'}`}
                  disabled={!isDataValid}
                >
                  {isHighLoadMode ? '🚀 START HIGH LOAD TEST' : '✨ GENERATE TEST DATA'}
                </button>
              )}

              {/* Отображение статистики High Load теста */}
              {isHighLoadMode && highLoadStats && (
                <div className="high-load-stats">
                  <h4>Результаты теста:</h4>
                  <div className="stats-grid">
                    <div>Время: {highLoadStats.durationMs ? (highLoadStats.durationMs / 1000).toFixed(2) + "s" : "N/A"}</div>
                    <div>Пользователи: {highLoadStats.users.created}/{highLoadStats.users.total}</div>
                    <div>Посты: {highLoadStats.posts.created + highLoadStats.posts.queued}/{highLoadStats.posts.total}</div>
                    <div>В очереди: {highLoadStats.posts.queued}</div>
                    <div>Ошибки: {highLoadStats.posts.failed}</div>
                  </div>
                </div>
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
              Test data generation is limited to system administrators only
            </div>
          </div>
        )}
      </div>

    </div>
  );
});