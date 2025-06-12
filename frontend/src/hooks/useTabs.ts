import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { logger } from '../utils/Logger';

/*
    Хук для управления вкладками в приложении.
    Позволяет переключаться между вкладками "Все" и "Мои" комментарии,
    синхронизирует состояние с URL и навигацией.
    Используется на главной странице и в профиле пользователя.
*/
export function useTabs() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const isInitialMount = useRef(true);

  // Инициализация вкладки из URL
  useEffect(() => {
    if (location.pathname !== '/') return;
    if (!isInitialMount.current) return;

    let newTab: 'all' | 'my' = 'all';

    if (location.state?.activeTab) {
      newTab = location.state.activeTab;
      logger.log(`[useTabs] Using tab from navigation state: ${newTab}`);
    } else {
      const searchParams = new URLSearchParams(location.search);
      const tabFromUrl = searchParams.get('tab');
      newTab = tabFromUrl === 'following' ? 'my' : 'all';
      logger.log(`[useTabs] Using tab from URL: ${newTab}`);
    }

    if (activeTab !== newTab) {
      logger.log(`[useTabs] Initial tab sync: ${newTab}`);
      setActiveTab(newTab);

      const expectedUrl = newTab === 'my' ? '/?tab=following' : '/';
      if (window.location.pathname + window.location.search !== expectedUrl) {
        window.history.replaceState(null, '', expectedUrl);
      }
    }

    isInitialMount.current = false;
  }, [activeTab, location.pathname, location.search, location.state]);

  // переключение вкладок
  const handleTabClick = (tab: 'all' | 'my') => {
    if (tab === activeTab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      logger.log(`[useTabs] Active tab ${tab} clicked, scrolling to top`);
      return;
    }

    logger.log(`[useTabs] Switching tab from ${activeTab} to ${tab}`);
    
    // Переключаем вкладку
    setActiveTab(tab);
    
    // Обновляем URL
    const newUrl = tab === 'my' ? '/?tab=following' : '/';
    window.history.pushState({ 
      activeTab: tab
    }, '', newUrl);
  };

  return {
    activeTab,
    handleTabClick
  };
}