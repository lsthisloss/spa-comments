import { makeAutoObservable } from "mobx";
import { logger } from "../utils/Logger";
import AuthStore from "./stores/AuthStore";
import SocketStore from "./stores/SocketStore";
import UserStore from "./stores/UserStore";
import PostStore from "./stores/PostStore";
import CommentStore from "./stores/CommentStore";
import SendFormStore from "./stores/SendFormStore";
import NavigationStore from "./stores/NavigationStore";

// Экспортируем интерфейс Stores
export interface Stores {
  authStore: AuthStore;
  socketStore: SocketStore;
  userStore: UserStore;
  postStore: PostStore;
  commentStore: CommentStore;
  sendFormStore: SendFormStore;
  navigationStore: NavigationStore;
}

/**
 * Фабрика для создания всех сторов с правильными зависимостями
 */
export function createStores(): Stores {
  logger.log("[Stores] Creating application stores...");
  
  // Создаем первичные сторы без зависимостей
  const authStore = new AuthStore();
  
  // Создаем временные заглушки для разрыва циклических зависимостей
  const tempUserStore = {} as UserStore;
  const tempPostStore = {} as PostStore;
  const tempCommentStore = {} as CommentStore;
  
  // Создаем SocketStore с заглушкой userStore
  const socketStore = new SocketStore(authStore, tempUserStore);
  
  // Создаем UserStore с заглушкой postStore
  const userStore = new UserStore(authStore, socketStore, tempPostStore);
  
  // Обновляем tempUserStore свойствами userStore
  Object.assign(tempUserStore, userStore);
  
  // Создаем CommentStore с заглушкой postStore
  const commentStore = new CommentStore(socketStore, userStore);
  
  // Обновляем tempCommentStore
  Object.assign(tempCommentStore, commentStore);
  
  // Создаем PostStore с реальными зависимостями
  const postStore = new PostStore(socketStore, userStore, commentStore);
  
  // Обновляем заглушку postStore
  Object.assign(tempPostStore, postStore);
  
  // Создаем остальные сторы
  const sendFormStore = new SendFormStore(socketStore, userStore);
  const navigationStore = new NavigationStore();
  
  const stores = {
    authStore,
    socketStore,
    userStore,
    postStore,
    commentStore,
    sendFormStore,
    navigationStore
  };
  
  // Создаем синглтон для доступа из любого места
  makeAutoObservable(storesContext);
  storesContext.stores = stores;
  
  logger.log("[Stores] All stores created successfully");
  return stores;
}

/**
 * Контекст сторов для глобального доступа
 */
export const storesContext = {
  stores: null as Stores | null,
  
  get initialized() {
    return !!this.stores;
  },
  
  init() {
    if (!this.stores) {
      this.stores = createStores();
    }
    return this.stores;
  },
  
  // Геттеры для удобного доступа
  get auth() { return this.stores?.authStore; },
  get socket() { return this.stores?.socketStore; },
  get user() { return this.stores?.userStore; },
  get post() { return this.stores?.postStore; },
  get comment() { return this.stores?.commentStore; },
  get sendForm() { return this.stores?.sendFormStore; },
  get navigation() { return this.stores?.navigationStore; },
};