import React from 'react';
import { Spin, Button, Typography } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, MessageOutlined, FileTextOutlined } from '@ant-design/icons';

/*
  Компонент для отображения индикатора загрузки и состояния списка.
  Показывает индикатор загрузки, пустое состояние или сообщение о конце списка.
  Универсален для постов и комментариев.
*/
interface LoadingIndicatorProps {
  loading: boolean;
  allLoaded: boolean;
  hasItems: boolean;
  onVisible: () => void;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRetry?: () => void;
  showRetryButton?: boolean;
  itemCount?: number;
  isListReady?: boolean;
  itemType?: 'posts' | 'comments'; // тип для универсальности
}

export const LoadingIndicator = ({
  loading,
  allLoaded,
  hasItems,
  emptyMessage,
  emptyIcon,
  onRetry,
  showRetryButton = false,
  itemCount,
  isListReady = true,
  itemType = 'posts', // По умолчанию посты
}: LoadingIndicatorProps) => {


  // Состояние загрузки
  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '20px 16px',
      }}>
        <Spin size="large" />
        <div style={{ 
          marginTop: '12px', 
          color: '#666', 
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Loading more {itemType}...
        </div>
      </div>
    );
  }

  // Пустой список - показываем когда нет элементов и все загружено
  if (allLoaded && !hasItems && isListReady) {
    const defaultEmptyMessage = itemType === 'comments' ? 'No comments yet' : 'No posts available';
    const defaultIcon = itemType === 'comments' ? <MessageOutlined /> : <FileTextOutlined />;
    
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 16px',
        color: '#8c8c8c',
        background: 'linear-gradient(145deg, #fafafa 0%, #f5f5f5 100%)',
        borderRadius: '12px',
        margin: '16px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ 
          fontSize: '32px', 
          marginBottom: '16px',
          color: '#d9d9d9',
        }}>
          {emptyIcon || defaultIcon}
        </div>
        
        <div style={{ 
          fontSize: '16px', 
          fontWeight: 500, 
          color: '#595959',
          marginBottom: '8px'
        }}>
          {emptyMessage || defaultEmptyMessage}
        </div>
        
        <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
          Be the first to {itemType === 'comments' ? 'leave a comment' : 'share something'}!
        </Typography.Text>
      </div>
    );
  }

  // Конец списка - показываем когда есть элементы и все загружено
  if (allLoaded && hasItems && isListReady) {
    const itemWord = itemType === 'comments' ? 'comment' : 'post';
    const threadWord = itemType === 'comments' ? 'thread' : 'feed';
    
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '32px 16px',
        color: '#8c8c8c',
        background: 'linear-gradient(145deg, #fafafa 0%, #f5f5f5 100%)',
        borderRadius: '12px',
        margin: '16px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        position: 'relative',
      }}>
        <div style={{ 
          fontSize: '24px', 
          marginBottom: '12px',
          color: '#52c41a',
        }}>
          <CheckCircleOutlined />
        </div>
        
        <div style={{ 
          fontSize: '16px', 
          fontWeight: 600, 
          marginBottom: '8px', 
          color: '#262626' 
        }}>
          You've reached the end of the {threadWord}
        </div>
        
        {itemCount && (
          <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
            Total: {itemCount} {itemWord}{itemCount !== 1 ? 's' : ''} loaded
          </Typography.Text>
        )}
        
        {showRetryButton && onRetry && (
          <div style={{ marginTop: '16px' }}>
            <Button 
              type="default" 
              size="small"
              icon={<ReloadOutlined />}
              onClick={onRetry}
              style={{ 
                borderRadius: '20px',
                borderColor: '#1890ff',
                color: '#1890ff'
              }}
            >
              Refresh {threadWord}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Не показываем ничего в остальных случаях
  return null;
};