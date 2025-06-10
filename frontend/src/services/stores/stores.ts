import { storesContext } from '../main/createStores';
// Реэкспортируем тип Stores
export type { Stores } from '../main/createStores';

// Инициализируем сторы при первом импорте
if (!storesContext.initialized) {
  storesContext.init();
}

// Экспортируем все сторы для удобного импорта
export const stores = storesContext.stores!;
export const authStore = stores.authStore;
export const socketStore = stores.socketStore;
export const userStore = stores.userStore;
export const postStore = stores.postStore;
export const commentStore = stores.commentStore;
export const sendFormStore = stores.sendFormStore;

// Для использования в React Context
export { storesContext };