import { useCallback } from 'react';
import { Comment, Post } from '../types/interfaces';

// Хуки для оценки высоты элементов ленты и получения ключей для рендеринга
export const usePostsFeed = () => {
  // оценка высоты поста
  const estimateItemHeight = useCallback((item: Post) => {
    // Базовая высота (аватар, заголовок, кнопки)
    const BASE_HEIGHT = 140;
    
    // Высота для изображения, если оно есть
    const imageHeight = item.imageUrl ? 208 : 0; // Изображение + отступы
    
    // Оценка высоты текста на основе количества символов
    const contentLength = item.content?.length || 0;
    const contentLines = Math.min(10, Math.ceil(contentLength / 80)); // ~80 символов на строку
    const contentHeight = contentLines * 20; // 20px на строку
    
   
    
    // Возвращаем итоговую оценку высоты
    return Math.max(BASE_HEIGHT, BASE_HEIGHT + imageHeight + contentHeight + 40);
  }, []);

  const getItemKey = useCallback((post: Post): string => {
    return `post-${post.id}`;
  }, []);

  return {
    estimateItemHeight,
    getItemKey
  };
};

export function useCommentsFeed() {
  const estimateItemHeight = useCallback((comment: Comment): number => {
    // базовые оценки для комментариев
    const baseHeight = 120;
    
    // Более точная оценка высоты текста
    const contentLength = comment.content?.length || 0;
    const contentLines = Math.min(8, Math.max(1, Math.ceil(contentLength / 80)));
    const contentHeight = contentLines * 20;
    
    // Дополнительные элементы
    const imageHeight = comment.imageUrl ? 128 + 16 : 0;
    const fileHeight = comment.fileUrl ? 40 : 0;
    
    return Math.ceil(baseHeight + contentHeight + imageHeight + fileHeight);
  }, []);

  const getItemKey = useCallback((comment: Comment) => {
    return `comment-${comment.id}`;
  }, []);

  return {
    estimateItemHeight,
    getItemKey,
  };
}