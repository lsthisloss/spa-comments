import { observer } from 'mobx-react-lite';
import { Spin, Typography } from 'antd';
import { appInitializer } from '../../services/main/AppInitializer';
import App from '../../App';

const { Text } = Typography;

/*
  Компонент, который отображает основной контент приложения.
*/
const AppLoader = observer(() => {

  // Показываем ошибку сервера
  if (appInitializer.isServerUnavailable || 
      (appInitializer.error && appInitializer.error.message.includes('Server is unavailable'))) {
    return (
      <div className="app-loader-container">
        <div className="app-loader-error-box">
          <Text type="danger" className="app-loader-error-title">
            🔌 Server Unavailable
          </Text>
          <Text type="secondary" className="app-loader-error-text">
            Unable to connect to the server. Please check your connection and try again.
          </Text>
          <button 
            onClick={() => window.location.reload()}
            className="app-loader-primary-button"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Показываем общую ошибку
  if (appInitializer.error && !appInitializer.initializing) {
    return (
      <div className="app-loader-container">
        <div className="app-loader-error-box">
          <Text type="danger" className="app-loader-app-error-title">
            ⚠️ Application Error
          </Text>
          <Text type="secondary" className="app-loader-error-text">
            {appInitializer.error.message}
          </Text>
          <button 
            onClick={() => window.location.reload()}
            className="app-loader-secondary-button"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

return (
  <div style={{ position: 'relative' }}>
    {(!appInitializer.initialized && appInitializer.initializing) && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <div className="app-loader-loading-container">
          <Spin size="large" />
        </div>
      </div>
    )}
    
    <App />
  </div>
);
});

export default AppLoader;