import { memo, useCallback, useRef, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Post } from '../../../types/interfaces';
import PostItem from '../../posts/PostItem';
import { useLocation } from 'react-router-dom';
import useNavigationHelper from '../../../hooks/useNavigation';

/*
  Компонент для отображения поста с комментариями.
  Используется в ленте постов и профиле пользователя.
  При клике на пост вызывает onClick с его slug.
  проп isNewItem для управления анимацией появления.
*/
interface MemoizedPostItemProps {
  post: Post;
  onClick?: (slug: string) => void;
  onHeightChange?: () => void;
  isNewItem?: boolean;
}

const PostItemWithComments = observer(({ 
  post, 
  onClick, 
  onHeightChange,
  isNewItem = false
}: MemoizedPostItemProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
  const { navigateToEntity } = useNavigationHelper();
  const location = useLocation();

  const isReturningFromPost = useMemo(() => {
    // Cинхронизируем логику с FeedItem
    const hasBackNavigation = location.state?.isBackNavigation === true;
    const fromPostPage = location.state?.fromPath?.startsWith('/post/');
    const isOnMainPage = location.pathname === '/';
    
    return hasBackNavigation && fromPostPage && isOnMainPage;
  }, [location.state, location.pathname]);

  // Отслеживаем изменения высоты через предложенную систему
  useEffect(() => {
    const handleHeightChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.itemId === post.id && onHeightChange) {
        onHeightChange();
      }
    };
    
    window.addEventListener('heightChanged', handleHeightChange);
    
    // Также реагируем на запросы принудительного обновления
    const handleRemeasureRequest = (e: Event) => {
      const customEvent = e as CustomEvent;
      const isForAll = e.type === 'remeasureAllItems';
      if ((customEvent.detail?.itemId === post.id || isForAll) && containerRef.current) {
        const height = containerRef.current.offsetHeight;
        
        if (height > 0 && onHeightChange) {
          // Отправляем событие изменения высоты
          window.dispatchEvent(new CustomEvent('heightChanged', {
            bubbles: true,
            detail: { itemId: post.id, height }
          }));
          
          onHeightChange();
        }
      }
    };
    
    window.addEventListener('remeasureItem', handleRemeasureRequest);
    window.addEventListener('remeasureAllItems', handleRemeasureRequest);
    
    return () => {
      window.removeEventListener('heightChanged', handleHeightChange);
      window.removeEventListener('remeasureItem', handleRemeasureRequest);
      window.removeEventListener('remeasureAllItems', handleRemeasureRequest);
    };
  }, [post.id, onHeightChange]);
  
  // Oбработка Show More
  const handleShowMore = useCallback(() => {
    if (onHeightChange) {
      // Вызываем обработчик изменения высоты
      onHeightChange();
      
      // Принудительно запрашиваем перемер элемента
      window.dispatchEvent(new CustomEvent('remeasureItem', {
        detail: { itemId: post.id }
      }));
    }
  }, [post.id, onHeightChange]);

  // Обработчик клика по посту
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(post.slug);
    } else {
      navigateToEntity('post', post.slug);
    }
  }, [post.slug, onClick, navigateToEntity]);

  return (
    <div 
      ref={containerRef}
      id={`post-${post.id}`}
      className={`post-container ${isNewItem && !isReturningFromPost ? 'fade-in' : ''}`}
      style={{ 
        boxSizing: 'border-box',
        width: '100%',
        position: 'relative',
        display: 'block',
      }}
    >
      <PostItem        
        post={post}
        onClick={handleClick}
        onShowMore={handleShowMore}
      />
    </div>
  );
});

export const MemoizedPostItem = memo(PostItemWithComments, (prevProps, nextProps) => {
  const prevPost = prevProps.post;
  const nextPost = nextProps.post;
  
  const shouldSkipUpdate = 
    prevPost.id === nextPost.id &&
    prevPost.content === nextPost.content &&
    prevPost.likes === nextPost.likes &&
    prevPost.imageUrl === nextPost.imageUrl &&
    prevPost.commentCount === nextPost.commentCount &&
    prevPost.user?.userName === nextPost.user?.userName &&
    prevPost.user?.role === nextPost.user?.role &&
    prevProps.isNewItem === nextProps.isNewItem && 
    // Optimized array comparison
    (prevPost.likedUserIds?.length || 0) === (nextPost.likedUserIds?.length || 0) &&
    prevPost.likedUserIds?.join(',') === nextPost.likedUserIds?.join(',');
    
  return shouldSkipUpdate;
});

export default MemoizedPostItem;