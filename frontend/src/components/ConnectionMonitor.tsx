import { useEffect } from 'react';
import { useSocketStore } from '../hooks/useStore';
import { observer } from 'mobx-react-lite';
import { logger } from '../utils/Logger';

const ConnectionMonitor = observer(() => {
  const socketStore = useSocketStore();
  
  useEffect(() => {
    logger.log('[ConnectionMonitor] Starting connection monitoring');
    
    // Первичная проверка при монтировании
    socketStore.checkConnections();
    
    // Регулярная проверка
    const checkInterval = setInterval(() => {
      socketStore.checkConnections();
    }, 30000);
    
    return () => {
      logger.log('[ConnectionMonitor] Stopping connection monitoring');
      clearInterval(checkInterval);
    };
  }, [socketStore]);
  
  return null; // Компонент не рендерит UI
});

export default ConnectionMonitor;