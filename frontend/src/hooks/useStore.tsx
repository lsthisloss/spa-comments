import { useContext } from 'react';
import { StoresContext } from '../contexts/storesContextValue';

// Общий хук для доступа ко всем сторам
export const useStores = () => useContext(StoresContext);

// Хуки для отдельных сторов
export const useAuthStore = () => useContext(StoresContext).authStore;
export const useUserStore = () => useContext(StoresContext).userStore;
export const useSocketStore = () => useContext(StoresContext).socketStore;
export const usePostStore = () => useContext(StoresContext).postStore;
export const useCommentStore = () => useContext(StoresContext).commentStore;
export const useSendFormStore = () => useContext(StoresContext).sendFormStore;
export const useTestStore = () => useContext(StoresContext).testStore;