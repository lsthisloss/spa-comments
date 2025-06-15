import { useContext } from 'react';
import { NavigationContext } from './NavigationContextValue';
import type { NavigationContextValue, NavigationState } from './NavigationContextValue';

export default function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  
  return context;
}

export type { NavigationState };