import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    watch: {
      usePolling: true, // Важно для Docker, особенно на Windows/Mac
    },
    proxy: {
      '/socket.io': {
        target: 'ws://backend:3001',
        ws: true,
      },
      '/uploads': {
        target: 'http://backend:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
});