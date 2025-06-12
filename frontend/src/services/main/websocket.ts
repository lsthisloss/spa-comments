import io, { Socket } from "socket.io-client";
import { logger } from "../../utils/Logger";

/*
  WebSocket клиент для подключения к серверу.
  Используется для обмена данными в реальном времени.
  Поддерживает аутентификацию через токен.
*/
export function createWebSocket(namespace: string, token?: string): typeof Socket | null {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  if (!baseUrl) {
    logger.error("[WebSocket] Socket URL не определен!");
    return null;
  }
  
  try {
    const socketConfig = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
      upgrade: true,
      // Добавляем отладочную информацию
      debug: import.meta.env.DEV,
      ...(token && { auth: { token } })
    };
    
    const fullUrl = `${baseUrl}${namespace}`;
    //logger.log(`[WebSocket] Creating socket for ${fullUrl} with config:`, socketConfig);
    
    const socket = io(fullUrl, socketConfig);
    
    socket.on('connect', () => {
      logger.info(`[WebSocket] ✅ Connected to ${namespace}, ID: ${socket.id}`);
    });
    
    socket.on('disconnect', (reason: string) => {
      logger.info(`[WebSocket] ❌ Disconnected from ${namespace}: ${reason}`);
    });
    
    socket.on('connect_error', (error: Error) => {
      logger.error(`[WebSocket] ⚠️ Connection error for ${namespace}:`, error);
    });
    
    socket.on('reconnect', (attemptNumber: number) => {
      logger.info(`[WebSocket] 🔄 Reconnected to ${namespace} after ${attemptNumber} attempts`);
    });
    
    socket.on('reconnect_attempt', (attemptNumber: number) => {
      logger.info(`[WebSocket] 🔄 Attempting to reconnect to ${namespace}, attempt ${attemptNumber}`);
    });
    
    socket.on('reconnect_failed', () => {
      logger.error(`[WebSocket] ❌ Failed to reconnect to ${namespace} after all attempts`);
    });
    
    return socket;
  } catch (error) {
    logger.error(`[WebSocket] Error creating socket for ${namespace}:`, error);
    return null;
  }
}

export function createAuthenticatedSocket(namespace: string, token: string): typeof Socket | null {
  return createWebSocket(namespace, token);
}

export function createPublicSocket(namespace: string): typeof Socket | null {
  return createWebSocket(namespace);
}