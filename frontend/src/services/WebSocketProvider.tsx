import { useEffect, useRef } from 'react';
import { createWebSocket } from './websocket';
import { WebSocketContext } from './WebSocketContext';

export default function WebSocketProvider({ children }: { children: React.ReactNode }) {
  console.log('WebSocketProvider rendered');
  const socketRef = useRef(createWebSocket());

  useEffect(() => {
    console.log('WebSocketProvider mounted');
    const socket = socketRef.current;
    return () => {
      console.log('WebSocketProvider unmounted');
      socket.off('heartbeat');
      socket.off('newComment');
      socket.close();
    };
  }, []);

  return <WebSocketContext.Provider value={socketRef.current}>{children}</WebSocketContext.Provider>;
}