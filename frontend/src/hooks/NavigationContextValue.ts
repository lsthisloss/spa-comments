import { createContext } from 'react';

export type EntityType = 'post' | 'comment' | 'user' | 'tag';

export interface NavigationState {
  forceRefresh?: boolean;
  // Other properties...
}

export interface NavigationContextValue {
  getState: () => NavigationState | null;
  getPath: () => string;
  navigateTo: (path: string, state?: NavigationState) => void;
  
  // Generic entity navigation method
  navigateToEntity: (type: EntityType, identifier: string, state?: NavigationState) => void;
  
  // Specific entity navigation methods
  navigateToPost: (postSlug: string, state?: NavigationState) => void;
  navigateToComment: (commentSlug: string, state?: NavigationState) => void;
  navigateToUser: (username: string, state?: NavigationState) => void;
  navigateToProfile: (username: string, state?: NavigationState) => void;
  navigateToTag: (tagName: string, state?: NavigationState) => void;
  goBack: () => void;
}

// Create context with null default value
export const NavigationContext = createContext<NavigationContextValue | null>(null);