import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigationStore } from '../services/stores/NavigationStore';
import { logger } from '../utils/Logger';

/**
 * Hook for centralized navigation logic that works with NavigationStore
 */
export function useNavigationHelper() {
  const navigate = useNavigate();

  /**
   * Navigate to a post or comment while preserving navigation context
   */
  const navigateToEntity = useCallback((
    entityType: 'post' | 'comment',
    slugOrId: string,
    onNavigate?: (slugOrId: string) => void
  ) => {
    if (!slugOrId) {
      logger.warn(`[NavigationHelper] Cannot navigate to ${entityType} with empty ID/slug`);
      return;
    }

    logger.log(`[NavigationHelper] Navigating to ${entityType}: ${slugOrId}`);
    
    // Allow component to override navigation if it has its own handler
    if (onNavigate) {
      onNavigate(slugOrId);
      return;
    }
    
    // Save current scroll position and navigation state
    const scrollPosition = window.scrollY;
    const state = {
      scrollPosition,
      fromFeed: location.pathname === '/' && !location.search.includes('tab=following'),
      fromFollowing: location.pathname === '/' && location.search.includes('tab=following'),
      fromUserProfile: location.pathname.startsWith('/profile/'),
      fromPost: location.pathname.startsWith('/post/'),
      fromComment: location.pathname.startsWith('/comment/'),
      slug: slugOrId,
    };
    
    // Use navigationStore to save this state
    const navigationState = navigationStore.saveNavigationState(
      entityType, 
      slugOrId,
      state
    );
    
    // Navigate to the target
    navigate(`/${entityType}/${slugOrId}`, { state: navigationState });
  }, [navigate]);

  /**
   * Navigate to user profile
   */
  const navigateToProfile = useCallback((userId: string) => {
    if (!userId) {
      logger.warn('[NavigationHelper] Cannot navigate to profile with empty user ID');
      return;
    }

    logger.log(`[NavigationHelper] Navigating to profile: ${userId}`);
    
    // Save current scroll position
    const scrollPosition = window.scrollY;
    
    navigate(`/profile/${userId}`, { 
      state: { 
        scrollPosition,
        fromFeed: location.pathname === '/' && !location.search.includes('tab=following'),
        fromFollowing: location.pathname === '/' && location.search.includes('tab=following'),
        fromPost: location.pathname.startsWith('/post/'),
        fromComment: location.pathname.startsWith('/comment/'),
        userId
      } 
    });
  }, [navigate]);

  /**
   * Navigate back with proper state handling
   */
  const navigateBack = useCallback(() => {
    navigationStore.handleBackNavigation(navigate);
  }, [navigate]);

  return {
    navigateToEntity,
    navigateToProfile,
    navigateBack
  };
}