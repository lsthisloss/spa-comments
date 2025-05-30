import { memo } from 'react';
import { Button } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { Post } from '../../../types/interfaces';

interface NewPostNotificationProps { 
  latestPost: Post | null;
  onFocusPost: (id: string) => void;
  newPostsCount: number;
  onLoadNewPosts: () => void;
  truncateContent: (text: string, maxLength?: number) => string;
}

export const NewPostNotification = memo(({ 
  newPostsCount, 
  onLoadNewPosts, 
}: NewPostNotificationProps) => {
  return (

    
    <div className="new-posts-bar">
      <Button 
        type="text" 
        className="new-posts-button" 
        onClick={onLoadNewPosts}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span>{newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'}</span>
        <DownOutlined style={{ marginLeft: 8 }} />
      </Button>
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.newPostsCount !== nextProps.newPostsCount) return false;
  if (prevProps.latestPost?.id !== nextProps.latestPost?.id) return false;
  return true;
});