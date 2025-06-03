import { Result, Button, Typography, Alert } from 'antd';
import { observer } from 'mobx-react-lite';
import { appInitializer } from '../services/AppInitializer';

const { Paragraph, Text } = Typography;

const ServerErrorPage = observer(() => {
  const handleRetry = () => {
    appInitializer.manualRetry();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Result
        status="500"
        title="Server Unavailable"
        subTitle="We're experiencing technical difficulties. Our team is working to resolve this issue."
        extra={[
          <Button 
            type="primary" 
            key="retry" 
            onClick={handleRetry}
            loading={appInitializer.initializing}
            disabled={!appInitializer.canRetry}
          >
            {appInitializer.canRetry ? 'Try Again' : 'Retrying...'}
          </Button>,
          <Button key="refresh" onClick={handleRefresh}>
            Refresh Page
          </Button>
        ]}
      >
        <div style={{ textAlign: 'left', maxWidth: '500px' }}>
          <Alert
            message="What's happening?"
            description={
              <div>
                <Paragraph>
                  The server is currently overloaded or undergoing maintenance. 
                  This usually resolves itself within a few minutes.
                </Paragraph>
                <Paragraph>
                  <Text strong>Retry attempts:</Text> {appInitializer.retryCount}/{appInitializer.maxRetries}
                </Paragraph>
                {appInitializer.error && (
                  <Paragraph>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Technical details: {appInitializer.error.message}
                    </Text>
                  </Paragraph>
                )}
              </div>
            }
            type="info"
            showIcon
            style={{ marginTop: '16px' }}
          />
        </div>
      </Result>
    </div>
  );
});

export default ServerErrorPage;