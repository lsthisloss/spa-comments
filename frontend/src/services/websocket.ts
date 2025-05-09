import io from 'socket.io-client';


export const createWebSocket = () => {
  const socket = io({
    transports: ['websocket'],
    path: '/socket.io',
  });

  socket.on('connect', () => console.log('WebSocket connected'));
  socket.on('disconnect', (reason: string) => console.warn('WebSocket disconnected:', reason));
  socket.on('connect_error', (error: Error) => console.error('WebSocket error:', error));

  console.log('Setting up WebSocket event listeners');


  return socket;
};