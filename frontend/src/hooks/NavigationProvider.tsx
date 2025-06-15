import { useRef, useEffect, ReactNode, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logger } from '../utils/Logger';
import { EntityType, NavigationContext, NavigationState } from './NavigationContextValue';

export function NavigationProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const stateRef = useRef<NavigationState | null>(null);
  const pathRef = useRef<string>(location.pathname);
  
  // Initialize on mount only
  useEffect(() => {
    // Try to restore from session storage
    const stored = sessionStorage.getItem('nav_state_v1');
    
    if (stored) {
      try {
        stateRef.current = JSON.parse(stored);
        logger.log('[Navigation] Restored state from session');
      } catch (e) {
        logger.error('[Navigation] Failed to parse stored state' + e);
      }
    } 
    // Otherwise use current location state
    else if (location.state) {
      stateRef.current = location.state as NavigationState;
      sessionStorage.setItem('nav_state_v1', JSON.stringify(location.state));
      logger.log('[Navigation] Captured initial state:', stateRef.current);
    }
    
    // Initialize path
    pathRef.current = location.pathname;
  }, []); 
  
    const getEntityUrl = (type: EntityType, identifier: string): string => {
    switch (type) {
      case 'post':
        return `/post/${identifier}`;
      case 'comment':
        return `/comment/${identifier}`;
      case 'user':
        return `/user/${identifier}`;
      case 'tag':
        return `/tag/${identifier}`;
      default:
        return '/';
    }
  };

  // Update path when it changes
  const value = useMemo(() => ({
    getState: () => stateRef.current,
    getPath: () => pathRef.current,
    
    // Generic navigation
    navigateTo: (path: string, state?: NavigationState) => {
      logger.log(`[Navigation] Navigating to: ${path}`);
      navigate(path, { state });
    },
    
    // Entity-based navigation
    navigateToEntity: (type: EntityType, identifier: string, state?: NavigationState) => {
      const url = getEntityUrl(type, identifier);
      logger.log(`[Navigation] Navigating to ${type}: ${identifier}`);
      navigate(url, { state });
    },
    
    // Post navigation
    navigateToPost: (postSlug: string, state?: NavigationState) => {
      logger.log(`[Navigation] Navigating to post: ${postSlug}`);
      navigate(`/post/${postSlug}`, { state });
    },
    
    // Comment navigation
    navigateToComment: (commentSlug: string, state?: NavigationState) => {
      logger.log(`[Navigation] Navigating to comment: ${commentSlug}`);
      navigate(`/comment/${commentSlug}`, { state });
    },
    
    // User navigation
    navigateToUser: (username: string, state?: NavigationState) => {
      logger.log(`[Navigation] Navigating to user: ${username}`);
      navigate(`/user/${username}`, { state });
    },
    
    // Profile navigation (alias for navigateToUser for compatibility)
    navigateToProfile: (username: string, state?: NavigationState) => {
      logger.log(`[Navigation] Navigating to profile: ${username}`);
      navigate(`/user/${username}`, { state });
    },
    
    // Tag navigation
    navigateToTag: (tagName: string, state?: NavigationState) => {
      logger.log(`[Navigation] Navigating to tag: ${tagName}`);
      navigate(`/tag/${tagName}`, { state });
    },
    
    // Go back
    goBack: () => {
      logger.log(`[Navigation] Going back`);
      navigate(-1);
    }
  }), [navigate]);
  
  
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}