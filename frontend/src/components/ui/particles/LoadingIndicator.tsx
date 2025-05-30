import React from 'react';
import { Spin, Button, Typography } from 'antd';
import { ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';

interface LoadingIndicatorProps {
  loading: boolean;
  allLoaded: boolean;
  hasItems: boolean;
  onVisible: () => void;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRetry?: () => void;
  showRetryButton?: boolean;
  itemCount?: number; //
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  loading,
  allLoaded,
  hasItems,
  onVisible,
  emptyMessage = "No more items",
  emptyIcon,
  onRetry,
  showRetryButton = false,
  itemCount,
}) => {
  React.useEffect(() => {
    if (!loading && !allLoaded) {
      onVisible();
    }
  }, [loading, allLoaded, onVisible]);

  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
      }}>
        <Spin size="large" />
        <div style={{ 
          marginTop: '12px', 
          color: '#666', 
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Loading more...
        </div>
      </div>
    );
  }

  if (allLoaded && hasItems) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '24px 16px',
        color: '#8c8c8c',
        background: 'linear-gradient(145deg, #fafafa 0%, #f5f5f5 100%)',
        borderRadius: '8px',
        margin: '16px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
      }}>
        <div style={{ 
          fontSize: '20px', 
          marginBottom: '8px',
          color: '#52c41a',
        }}>
          {emptyIcon || <CheckCircleOutlined />}
        </div>
        
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 500, 
          marginBottom: '4px', 
          color: '#262626' 
        }}>
          {emptyMessage}
        </div>
        
        {itemCount && (
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            Total: {itemCount} item{itemCount !== 1 ? 's' : ''}
          </Typography.Text>
        )}
        
        {showRetryButton && onRetry && (
          <div style={{ marginTop: '12px' }}>
            <Button 
              className="scale-in"
              type="link" 
              size="small"
              icon={<ReloadOutlined />}
              onClick={onRetry}
              style={{ color: '#1890ff' }}
            >
              Refresh
            </Button>
          </div>
        )}
      </div>
    );
  }

  return null;
};