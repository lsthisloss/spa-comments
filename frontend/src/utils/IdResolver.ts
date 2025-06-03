import { logger } from "../utils/Logger";
import { stores } from '../services/stores';

/**
 * Класс для работы с ID и slug постов/комментариев
 */
export class IdResolver {
  /**
   * Преобразует slug в ID
   */
  static resolveIds(
    type: "post" | "comment", 
    parentIdOrPostId?: string, 
    postIdForNestedComment?: string, 
    parentSlug?: string, 
    postSlug?: string
  ): { parentId?: string; postId?: string; error?: string } {
    const { postStore, commentStore } = stores;
    let effectiveParentId = parentIdOrPostId;
    let effectivePostId = postIdForNestedComment;
    
    // Проверка инициализации сторов
    if (!commentStore || !postStore) {
      logger.error("[IdResolver] Stores not initialized");
      return { error: "Application not fully initialized" };
    }
    
    // Resolve parent comment from slug if needed
    if (type === "comment" && !effectiveParentId && parentSlug) {
      const comment = commentStore.getCommentBySlug(parentSlug);
      if (comment) {
        effectiveParentId = comment.id;
        
        // If comment has postId, use it
        if (!effectivePostId && comment.postId) {
          logger.log(`[IdResolver] Using postId from parent comment: ${comment.postId}`);
          effectivePostId = comment.postId;
        }
      } else {
        return { error: "Parent comment not found" };
      }
    }
    
    // Resolve post from slug if needed
    if (!effectivePostId && postSlug) {
      // Check if postSlug is actually a UUID
      const isUUID = this.isUUID(postSlug);
      
      if (isUUID) {
        // If UUID, use directly as ID
        logger.log(`[IdResolver] Using postSlug as postId directly: ${postSlug}`);
        effectivePostId = postSlug;
      } else {
        // If slug, lookup post in store
        const post = postStore.getPostBySlug(postSlug);
        if (post) {
          effectivePostId = post.id;
          logger.log(`[IdResolver] Resolved postSlug ${postSlug} to ID ${effectivePostId}`);
        } else {
          logger.error(`[IdResolver] Post not found for slug: ${postSlug}`);
          return { error: "Post not found" };
        }
      }
    }
    
    // Validation for comments
    if (type === "comment" && !effectivePostId) {
      logger.error("[IdResolver] Failed to determine postId for comment");
      return { error: "Cannot determine post ID for this comment" };
    }
    
    return { parentId: effectiveParentId, postId: effectivePostId };
  }

  /**
   * Проверяет, является ли строка UUID
   */
  static isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }
}