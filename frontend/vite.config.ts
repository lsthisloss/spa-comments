import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    watch: {
      usePolling: true, // Важно для Docker, особенно на Windows/Mac
    },
    hmr: {
      port: 3000,
    },
    proxy: {
      // WebSocket proxy для socket.io
      '/socket.io': {
        target: 'http://backend:3001',
        ws: true,
        changeOrigin: true,
      },
      // Proxy для загрузки файлов
      '/uploads': {
        target: 'http://backend:3001',
        changeOrigin: true,
      },
      // Дополнительно можно добавить API proxy если нужно
      '/api': {
        target: 'http://backend:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
});