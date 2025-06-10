import React, { ReactNode} from 'react';
import { stores } from '../services/stores/stores';
import { StoresContext } from './storesContextValue';

/*
  Контекст для доступа к MobX сторам в React приложении.
  Позволяет использовать сторы в компонентах без необходимости их пробрасывания через пропсы.
*/
export const StoresProvider: React.FC<{ children: ReactNode }> = ({ children }) => {

  return (
    <StoresContext.Provider value={stores}>
      {children}
    </StoresContext.Provider>
  );
};