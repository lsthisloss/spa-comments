import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { message } from 'antd';
import { useUserStore, useTestStore } from '../../../hooks/useStore';
import { generateTestData, stopCrashTest } from "../../../utils/test/test-data-generator";
import { highLoadTestManager, HighLoadTestConfig } from '../../../utils/test/high-load-test';

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
  const userStore = useUserStore();
  const testStore = useTestStore();
  const canExecuteTests = userStore.canExecuteDebugTests;

  // Ссылки для перетаскивания
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const currentPositionRef = useRef(testStore.panelPosition);
  const panelRef = useRef<HTMLDivElement>(null);

  // Синхронизируем текущую позицию с store
  useEffect(() => {
    currentPositionRef.current = testStore.panelPosition;
  }, [testStore.panelPosition]);

  // Инициализация позиции при первом открытии
  useEffect(() => {
    if (isVisible && testStore.panelPosition.top === 100 && testStore.panelPosition.left === 100) {
      const newPosition = {
        top: Math.max(100, parentPosition.top),
        left: Math.max(100, parentPosition.left + 360)
      };
      testStore.setPanelPosition(newPosition);
    }
  }, [isVisible, parentPosition, testStore]);

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
      testStore.setPanelPosition(currentPositionRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [testStore]);

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
    if (testStore.isTestRunning) {
      // Остановка теста
      message.info({
        content: `⚠️ Остановка теста...`,
        duration: 2,
      });

      if (testStore.isHighLoadMode) {
        highLoadTestManager.stopTest();
      } else {
        stopCrashTest();
      }

      testStore.setTestRunning(false);
      return;
    }

    // Проверка валидности данных
    if (!testStore.isDataValid) {
      message.error(`Проверьте правильность введенных данных`);
      return;
    }

    if (!testStore.isHighLoadMode && testStore.totalMessages > 100000) {
      message.warning({
        content: `Вы пытаетесь создать ${testStore.totalMessages.toLocaleString()} сообщений. Это больше 100000 и не имеет смысла для обычного тестирования.`,
        duration: 8,
      });
      return;
    }

    testStore.setTestRunning(true);
    testStore.setHighLoadStats(null);

    if (testStore.isHighLoadMode) {
      // Запуск High Load теста
      message.warning({
        content: `🚀 HIGH LOAD: Запускается тест с ${testStore.usersCount} пользователями × ${testStore.postsPerUser} постов = ${testStore.totalMessages.toLocaleString()} сообщений!`,
        duration: 5,
      });

      const testConfig: Partial<HighLoadTestConfig> = {
        totalUsers: testStore.usersCount,
        postsPerUser: testStore.postsPerUser,
        withMedia: testStore.generateWithMedia,
        concurrentUsers: testStore.concurrentUsers,
        testMode: 'normal'
      };

      highLoadTestManager.startTest(testConfig)
        .then((stats) => {
          testStore.setHighLoadStats(stats);
          message.success(`High Load тест завершен: ${stats.users.created} пользователей, ${stats.posts.created + stats.posts.queued} постов`);
        })
        .catch((error) => {
          message.error(`Ошибка при выполнении High Load теста: ${error.message}`);
        })
        .finally(() => {
          testStore.setTestRunning(false);
        });
    } else {
      // Запуск обычного теста
      const mediaInfo = testStore.generateWithMedia ? 'с изображениями и файлами' : 'только текст';

      message.info({
        content: `Генерируем ${testStore.usersCount} пользователей с ${testStore.postsPerUser} постами каждый (${testStore.totalMessages.toLocaleString()} сообщений, ${mediaInfo})...`,
        duration: 3,
      });

      // Очищаем предыдущую статистику
      testStore.setRegularTestStats(null);

      const startTime = Date.now();

      generateTestData(testStore.usersCount, testStore.postsPerUser, true, testStore.generateWithMedia)
        .then((result) => {
          // Создаем статистику по результатам
          const endTime = Date.now();
          const stats = {
            usersCreated: (result as any)?.usersCreated || testStore.usersCount,
            postsCreated: (result as any)?.postsCreated || 0,
            totalUsers: testStore.usersCount,
            totalPosts: testStore.totalMessages,
            durationMs: endTime - startTime,
            withMedia: testStore.generateWithMedia,
            errors: (result as any)?.errors || 0
          };

          testStore.setRegularTestStats(stats);

          message.success({
            content: `Regular тест завершен: ${stats.usersCreated} пользователей, ${stats.postsCreated} постов за ${(stats.durationMs / 1000).toFixed(2)}с`,
            duration: 5,
          });
        })
        .catch((error) => {
          message.error(`Ошибка при выполнении Regular теста: ${error.message}`);
        })
        .finally(() => {
          testStore.setTestRunning(false);
        });
    }
  };

  // Если панель не видима, не рендерим ее
  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      className="test-data-panel"
      style={{
        position: 'fixed',
        top: `${testStore.panelPosition.top}px`,
        left: `${testStore.panelPosition.left}px`,
        zIndex: 10001
      }}
    >
      {/* Header */}
      <div
        className="test-data-panel__header"
        onMouseDown={handleMouseDown}
      >
        <div className="test-data-panel__title-container">
          <span className="test-data-panel__emoji">{testStore.isHighLoadMode ? '🚀' : '🧪'}</span>
          <span className="test-data-panel__title">TEST DATA GENERATOR</span>
          {testStore.isTestRunning && (
            <span className="test-data-panel__running-indicator">
              ⚠️ RUNNING
            </span>
          )}
        </div>



        <div className="test-data-panel__controls">

          {(testStore.highLoadStats || testStore.regularTestStats) && (
            <button
              className="test-data-panel__button test-data-panel__button--clear"
              onClick={() => {
                testStore.setHighLoadStats(null);
                testStore.setRegularTestStats(null);
                message.info('Статистика очищена');
              }}
              title="Clear test statistics"
            >
              🗑️
            </button>
          )}

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
                className={`mode-button ${!testStore.isHighLoadMode ? 'active' : ''}`}
                onClick={() => testStore.setHighLoadMode(false)}
                disabled={testStore.isTestRunning}
              >
                🧪 Regular Mode
              </button>
              <button
                className={`mode-button ${testStore.isHighLoadMode ? 'active' : ''}`}
                onClick={() => testStore.setHighLoadMode(true)}
                disabled={testStore.isTestRunning}
              >
                🚀 High Load Mode
              </button>
            </div>

            {/* Настройки генерации данных */}
            <div className="test-data-panel__settings">
              {/* Настройка пользователей */}
              <div className="form-group">
                <label htmlFor="testUsersCount">
                  Users ({testStore.isHighLoadMode ? '1-100000' : '1-100'}):
                </label>
                <input
                  id="testUsersCount"
                  type="number"
                  value={testStore.usersCount}
                  onChange={(e) => testStore.setUsersCount(parseInt(e.target.value) || 0)}
                  min={1}
                  max={testStore.maxUsers}
                  className={testStore.usersCount < 1 || testStore.usersCount > testStore.maxUsers ? 'error' : ''}
                  disabled={testStore.isTestRunning}
                />
                {(testStore.usersCount < 1 || testStore.usersCount > testStore.maxUsers) && (
                  <div className="error-message">
                    ⚠️ Должно быть от 1 до {testStore.maxUsers}
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
                  value={testStore.postsPerUser}
                  onChange={(e) => testStore.setPostsPerUser(parseInt(e.target.value) || 0)}
                  min={1}
                  max={1000}
                  className={testStore.postsPerUser < 1 || testStore.postsPerUser > 1000 ? 'error' : ''}
                  disabled={testStore.isTestRunning}
                />
                {(testStore.postsPerUser < 1 || testStore.postsPerUser > 1000) && (
                  <div className="error-message">
                    ⚠️ Должно быть от 1 до 1000
                  </div>
                )}
              </div>

              {/* Настройка одновременных пользователей для High Load */}
              {testStore.isHighLoadMode && (
                <div className="form-group">
                  <label htmlFor="concurrentUsers">
                    Concurrent Users (1-50):
                  </label>
                  <input
                    id="concurrentUsers"
                    type="number"
                    value={testStore.concurrentUsers}
                    onChange={(e) => testStore.setConcurrentUsers(parseInt(e.target.value) || 0)}
                    min={1}
                    max={50}
                    className={testStore.concurrentUsers < 1 || testStore.concurrentUsers > 50 ? 'error' : ''}
                    disabled={testStore.isTestRunning}
                  />
                  {(testStore.concurrentUsers < 1 || testStore.concurrentUsers > 50) && (
                    <div className="error-message">
                      ⚠️ Должно быть от 1 до 50
                    </div>
                  )}
                </div>
              )}

              {/* Чекбокс для медиа */}
              <div className="checkbox-group">
                <label className={`checkbox-label ${testStore.generateWithMedia ? 'active media-active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={testStore.generateWithMedia}
                    onChange={(e) => testStore.setGenerateWithMedia(e.target.checked)}
                    disabled={testStore.isTestRunning}
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
                {testStore.isHighLoadMode ? '🚀' : '📈'} Total messages:
                <span>
                  <strong> {testStore.totalMessages.toLocaleString()}</strong>
                </span>
              </div>

              {/* Информация о High Load режиме */}
              {testStore.isHighLoadMode && (
                <div className="info-panel">
                  High Load режим: одновременно создаётся до {testStore.concurrentUsers} пользователей,
                  каждый генерирует до {testStore.postsPerUser} постов.
                </div>
              )}

              {/* Кнопка запуска/остановки */}
              {testStore.isTestRunning ? (
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
                  className={`generate-button ${testStore.isDataValid ? 'enabled' : 'disabled'}`}
                  disabled={!testStore.isDataValid}
                >
                  {testStore.isHighLoadMode ? '🚀 START HIGH LOAD TEST' : '✨ GENERATE TEST DATA'}
                </button>
              )}

              {/* Отображение результатов High Load теста */}
              {testStore.isHighLoadMode && testStore.highLoadStats && (
                <div className="high-load-stats">
                  <h4>Результаты High Load теста:</h4>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-label">Время выполнения:</span>
                      <span className="stat-value">
                        {testStore.highLoadStats.durationMs ? (testStore.highLoadStats.durationMs / 1000).toFixed(2) + "s" : "N/A"}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Пользователи:</span>
                      <span className="stat-value">
                        {testStore.highLoadStats.users.created}/{testStore.highLoadStats.users.total}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Посты созданы:</span>
                      <span className="stat-value">
                        {testStore.highLoadStats.posts.created}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">В очереди:</span>
                      <span className="stat-value">
                        {testStore.highLoadStats.posts.queued || 0}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Ошибки:</span>
                      <span className="stat-value error">
                        {testStore.highLoadStats.posts.failed || 0}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Всего постов:</span>
                      <span className="stat-value">
                        {(testStore.highLoadStats.posts.created || 0) + (testStore.highLoadStats.posts.queued || 0)}/{testStore.highLoadStats.posts.total || 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!testStore.isHighLoadMode && testStore.regularTestStats && (
                <div className="regular-test-stats">
                  <h4>Результаты Regular теста:</h4>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-label">Время выполнения:</span>
                      <span className="stat-value">
                        {(testStore.regularTestStats.durationMs / 1000).toFixed(2)}s
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Пользователи:</span>
                      <span className="stat-value">
                        {testStore.regularTestStats.usersCreated}/{testStore.regularTestStats.totalUsers}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Посты созданы:</span>
                      <span className="stat-value">
                        {testStore.regularTestStats.postsCreated}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Всего постов:</span>
                      <span className="stat-value">
                        {testStore.regularTestStats.postsCreated}/{testStore.regularTestStats.totalPosts}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Медиа контент:</span>
                      <span className="stat-value">
                        {testStore.regularTestStats.withMedia ? '🖼️ Включен' : '📝 Только текст'}
                      </span>
                    </div>
                    {testStore.regularTestStats.errors > 0 && (
                      <div className="stat-item">
                        <span className="stat-label">Ошибки:</span>
                        <span className="stat-value error">
                          {testStore.regularTestStats.errors}
                        </span>
                      </div>
                    )}
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