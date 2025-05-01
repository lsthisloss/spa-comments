import { createContext, useEffect } from 'react';
import { createWebSocket } from '../services/websocket';

export const WebSocketContext = createContext<WebSocket | null>(null);

export default function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const socket = createWebSocket();

  useEffect(() => {
    return () => socket.close();
  }, [socket]);

  return <WebSocketContext.Provider value={socket}>{children}</WebSocketContext.Provider>;
}