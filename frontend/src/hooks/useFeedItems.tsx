import { useCallback } from 'react';
import { Comment, Post } from '../types/interfaces';

// Хуки для оценки высоты элементов ленты и получения ключей для рендеринга
export const usePostsFeed = () => {
  // оценка высоты поста
  const estimateItemHeight = useCallback((item: Post) => {
    // Базовые компоненты поста
    const HEADER_HEIGHT = 60; // Аватар + имя + время
    const FOOTER_HEIGHT = 50; // Кнопки лайка/комментариев
    const PADDING = 20; // Отступы
    
    // Оценка высоты текста
    const contentLength = item.content?.length || 0;
    const contentLines = Math.max(1, Math.ceil(contentLength / 80)); // ~80 символов на строку
    const textHeight = Math.max(40, contentLines * 20); // минимум 40px, 20px за строку
    
    // Высота изображения
    let imageHeight = 0;
    if (item.imageUrl) {
      imageHeight = 120; // Фиксированная высота изображения + отступы
    }
    
    // Высота файла (если есть)
    let fileHeight = 0;
    if (item.fileName || item.fileUrl) {
      fileHeight = 40;
    }
    
    const totalHeight = HEADER_HEIGHT + textHeight + imageHeight + fileHeight + FOOTER_HEIGHT + PADDING;
    
    // Возвращаем итоговую оценку высоты
    return totalHeight;
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