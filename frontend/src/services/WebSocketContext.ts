import { createContext } from 'react';
import { createWebSocket } from './websocket';

export const WebSocketContext = createContext<ReturnType<typeof createWebSocket> | null>(null);