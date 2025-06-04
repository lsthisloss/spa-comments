import React, { ReactNode} from 'react';
import { stores } from '../services/stores';
import { StoresContext } from './storesContextValue';


export const StoresProvider: React.FC<{ children: ReactNode }> = ({ children }) => {

  return (
    <StoresContext.Provider value={stores}>
      {children}
    </StoresContext.Provider>
  );
};