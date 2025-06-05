import io from "socket.io-client";
import { logger } from "../utils/Logger";

// Определяем собственный интерфейс для настроек Socket.IO
interface SocketConfig {
  transports: string[];
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
  forceNew?: boolean;
  auth?: {
    token: string;
  };
}

export function createWebSocket(namespace: string, token?: string, testMode = false) {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  if (!baseUrl) {
    logger.error("[WebSocket] Socket URL не определен!");
    return null;
  }
  
  try {
    // Базовая конфигурация
    const socketConfig: SocketConfig = {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      forceNew: true
    };
    
    // Добавляем токен если он есть
    if (token) {
      logger.info(`[WebSocket] Подключение к ${namespace} с токеном`);
      socketConfig.auth = { token };
    } else {
      logger.info(`[WebSocket] Подключение к ${namespace} без токена`);
    }
    
    // Добавляем параметр тестового режима если нужно
    const query: Record<string, string> = {};
    if (testMode) {
      query.testMode = 'true';
    }
    
    // Подключаемся с правильными параметрами
    logger.info(`[WebSocket] Создаю соединение к ${baseUrl}${namespace}`);
    const socket = io(`${baseUrl}${namespace}`, {
      ...socketConfig,
      query
    });
    
    // Добавляем обработчики событий
    socket.on('connect', () => {
      logger.info(`[WebSocket] ✅ Подключен к ${namespace}, ID: ${socket.id}`);
    });
    
    socket.on('disconnect', (reason: string) => {
      logger.info(`[WebSocket] ❌ Отключен от ${namespace}: ${reason}`);
    });
    
    socket.on('connect_error', (error: Error) => {
      logger.error(`[WebSocket] ⚠️ Ошибка подключения к ${namespace}: ${error.message}`);
    });

    return socket;
  } catch (error) {
    logger.error(`[WebSocket] Ошибка создания сокета для ${namespace}:`, error);
    return null;
  }
}