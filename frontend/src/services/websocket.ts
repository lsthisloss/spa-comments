import io from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

export const createWebSocket = () => {
  const socket = io(WS_URL, {
    transports: ['websocket'],
  });

  socket.on('connect', () => console.log('WebSocket connected'));
  socket.on('disconnect', (reason: string) => console.warn('WebSocket disconnected:', reason));
  socket.on('connect_error', (error: Error) => console.error('WebSocket error:', error));

  console.log('Setting up WebSocket event listeners');


  return socket;
};