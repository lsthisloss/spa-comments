import { Post } from './interfaces';
import { IPostStore } from '../services/stores/PostStore';

declare global {
  interface Window {
    // Дебаггинг для PostStore
    __POST_STORE?: {
      getPostBySlug?: (slug: string) => Post | null;
    };
    
    // Глобальная временная метка инициализации приложения
    APP_INIT_TIME: string;
    
    // Глобальный менеджер скролла
    scrollManager?: {
      clearAllScrollStates: () => void;
      clearScrollState: (key: string) => void;
    };
    
    // Режим тестирования (из PostStore)
    __CRASH_TEST_MODE__?: boolean;
    
    stores?: {
      socketStore?: { reconnectAll?: () => void };
      postStore?: IPostStore;
      [key: string]: unknown;
    };
  }
}