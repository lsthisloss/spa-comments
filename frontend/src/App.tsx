import WebSocketProvider from './components/WebSocketProvider';
import MainPage from './pages/MainPage';

export default function App() {
  return (
    <WebSocketProvider>
      <MainPage />
    </WebSocketProvider>
  );
}