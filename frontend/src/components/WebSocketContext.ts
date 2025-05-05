import { createContext } from 'react';
import { createWebSocket } from '../services/websocket';

export const WebSocketContext = createContext<ReturnType<typeof createWebSocket> | null>(null);