const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export const createWebSocket = () => {
  const socket = new WebSocket(WS_URL);

  socket.onopen = () => console.log('WebSocket connected');
  socket.onclose = (event) => {
    console.warn('WebSocket disconnected:', event.reason || 'Unknown reason');
  };
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return socket;
};