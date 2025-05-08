import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0', // важно!
    proxy: {
      '/api': 'http://backend:3000',
      '/ws': {
        target: 'ws://backend:3000',
        ws: true,
      },
    },
  },
  plugins: [react()],
})