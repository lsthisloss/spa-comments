import io from "socket.io-client";
import { logger } from "../utils/Logger";

// Для отслеживания состояния соединения
const socketState = {
  connections: new Map<string, boolean>(),
};

export function createWebSocket(namespace: string, token?: string) {
  const wsUrl = import.meta.env.VITE_WS_URL + namespace;
  
  // Для /users не требуем токен, для остальных сокетов - требуем
  if (!token && namespace !== "/users") {
    logger.warn(`Cannot create WebSocket for ${namespace} - token required but not provided`);
    return null;
  }

  const options = token ? { 
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    timeout: 10000
  } : {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    timeout: 10000
  };
  
  try {
    logger.info(`[WebSocket] Creating WebSocket for ${namespace}${token ? ' with token' : ' without token'}`);
    
    const socket = io(wsUrl, options);
    
    socket.on('connect', () => {
      logger.info(`[WebSocket] Connected to ${namespace} namespace with token: ${token ? 'provided' : 'none'}`);
      socketState.connections.set(namespace, true);
    });
    
    socket.on('disconnect', (reason: string) => {
      logger.debug(`[WebSocket] Disconnected from ${namespace} namespace: ${reason}`);
      socketState.connections.set(namespace, false);
    });

    socket.on('connect_error', (err: Error) => {
      logger.error(`[WebSocket] Connection error to ${namespace} namespace:`, err.message);
    });

    socket.on('error', (err: Error) => {
      logger.error(`[WebSocket] Socket error on ${namespace}:`, err.message);
    });

    socket.io.on('reconnect_attempt', (attempt: number) => {
      logger.debug(`[WebSocket] Reconnect attempt ${attempt} for ${namespace}`);
    });

    socket.io.on('reconnect', (attempt: number) => {
      logger.info(`[WebSocket] Reconnected to ${namespace} after ${attempt} attempts`);
    });

    return socket;
  } catch (error) {
    logger.error(`[WebSocket] Failed to create socket for ${namespace}:`, error);
    return null;
  }
}