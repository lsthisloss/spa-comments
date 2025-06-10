import { memo, useCallback, useState } from 'react';
import { Button } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { Post } from '../../../types/interfaces';

/*
  Компонент для отображения уведомления о новых постах.
  Показывает кнопку с количеством новых постов и анимацией при клике.
  При клике прокручивает страницу вверх и загружает новые посты.
*/
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
  // Состояние для анимации
  const [isAnimating, setIsAnimating] = useState(false);

  // Обработчик клика с анимацией
  const handleClick = useCallback(() => {
    // Активируем анимацию мгновенно
    setIsAnimating(true);

    // Прокручиваем страницу вверх перед загрузкой новых постов
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      onLoadNewPosts();
    }, 400);
  }, [onLoadNewPosts]);

  return (
    <div className="new-posts-bar">
      <Button
        type="text"
        className={`new-posts-button ${isAnimating ? 'animate-click' : ''}`}
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'scale(1) translateY(0) rotate(0deg)',
          opacity: isAnimating ? 0 : 1,
          transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 1s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.8s ease',
          overflow: 'hidden',
          color: '#1890ff',
          fontWeight: 'bold',
          borderBottom: '1px solid #e0e0e0',
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