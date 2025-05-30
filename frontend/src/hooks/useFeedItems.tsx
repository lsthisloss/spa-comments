import { useCallback } from 'react';
import { Comment, Post } from '../types/interfaces';

// Hook for posts feeds
export const usePostsFeed = () => {
  const estimateItemHeight = useCallback((post: Post): number => {
    const baseHeight = 180;
    const textLength = post.content?.length || 0;
    const textHeight = Math.ceil(textLength / 80) * 20;
    const imageHeight = post.imageUrl ? 300 : 0;
    const fileHeight = post.fileUrl ? 40 : 0;
    
    return Math.max(baseHeight + textHeight + imageHeight + fileHeight, 150);
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
    const baseHeight = 180;
    const textLength = comment.content?.length || 0;
    const textHeight = Math.ceil(textLength / 80) * 20;
    const imageHeight = comment.imageUrl ? 300 : 0;
    const fileHeight = comment.fileUrl ? 40 : 0;
    
    return Math.max(baseHeight + textHeight + imageHeight + fileHeight, 150);
  }, []);

  const getItemKey = useCallback((comment: Comment) => {
    return `comment-${comment.id}`;
  }, []);

  return {
    estimateItemHeight,
    getItemKey,
  };
}