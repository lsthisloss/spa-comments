import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import { appInitializer } from '../services/AppInitializer';
import { AppInitializingLoader } from './ui/AppInitializingLoader';

// Компонент-обертка для отображения загрузки
export const AppLoader = () => {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const checkInitialized = async () => {
      if (!appInitializer.initialized) {
        await appInitializer.initialize();
      }
      setTimeout(() => setLoading(false), 100);
    };
    
    checkInitialized();
  }, []);

  if (loading) {
    return <AppInitializingLoader />;
  }

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};