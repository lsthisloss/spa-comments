import { observer } from 'mobx-react-lite';
import { Spin, Typography } from 'antd';
import { appInitializer } from '../services/AppInitializer';
import App from '../App';
import styles from '../styles/components/_AppLoader.module.scss';

const { Text } = Typography;

const AppLoader = observer(() => {

  // Показываем ошибку сервера
  if (appInitializer.isServerUnavailable || 
      (appInitializer.error && appInitializer.error.message.includes('Server is unavailable'))) {
    return (
      <div className={styles.container}>
        <div className={styles.errorBox}>
          <Text type="danger" className={styles.errorTitle}>
            🔌 Server Unavailable
          </Text>
          <Text type="secondary" className={styles.errorText}>
            Unable to connect to the server. Please check your connection and try again.
          </Text>
          <button 
            onClick={() => window.location.reload()}
            className={styles.primaryButton}
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
      <div className={styles.container}>
        <div className={styles.errorBox}>
          <Text type="danger" className={styles.appErrorTitle}>
            ⚠️ Application Error
          </Text>
          <Text type="secondary" className={styles.errorText}>
            {appInitializer.error.message}
          </Text>
          <button 
            onClick={() => window.location.reload()}
            className={styles.secondaryButton}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {(!appInitializer.initialized || !appInitializer.socketsReady) && (
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
          <div className={styles.loadingContainer}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>Loading application...</p>
          </div>
        </div>
      )}
      
      <App />
    </div>
  );
});

export default AppLoader;