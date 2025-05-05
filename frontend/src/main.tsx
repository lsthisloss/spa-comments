import { createRoot } from 'react-dom/client';
import App from './App';
import WebSocketProvider from './components/WebSocketProvider';

createRoot(document.getElementById('root')!).render(
  <WebSocketProvider>
    <App />
  </WebSocketProvider>
);