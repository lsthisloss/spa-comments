import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://backend:3000',
      '/ws': {
        target: 'ws://backend:3000',
        ws: true,
      },
      '/socket.io': {
        target: 'ws://backend:3000',
        ws: true,
      },
      '/uploads': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
})