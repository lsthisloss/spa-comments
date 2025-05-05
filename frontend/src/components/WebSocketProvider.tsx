import { useEffect, useRef } from 'react';
import { createWebSocket } from '../services/websocket';
import { WebSocketContext } from './WebSocketContext';

export default function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef(createWebSocket());

  useEffect(() => {
    const socket = socketRef.current;
  
    socket.on('connect', () => {
      console.log('WebSocket connected');
    });
  

    return () => {
      console.log('Cleaning up WebSocket event listeners');
      socket.off('heartbeat');
      socket.off('newComment');
      socket.close();
    };
  }, []);

  return <WebSocketContext.Provider value={socketRef.current}>{children}</WebSocketContext.Provider>;
}