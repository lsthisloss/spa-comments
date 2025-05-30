import { action, makeObservable, observable } from "mobx";
import { logger } from '../../utils/Logger';

/**
 * Базовые типы для работы с элементами (посты/комментарии)
 */
export interface BaseItem {
  id: string;
  createdAt: string;
  likes?: number;
  likedUserIds?: string[];
  content: string;
  userName?: string;
}

/**
 * Абстрактный базовый класс для хранилищ данных
 */
export abstract class BaseStore<T extends BaseItem> {
  // Настройки сортировки
  sort: 'date' | 'likes' = 'date';
  
  // Карты для хранения служебных данных
  loadingMap = observable.map<string, boolean>();
  totalItemsMap = observable.map<string, number>();
  currentPageMap = observable.map<string, number>();
  loadedMap = observable.map<string, boolean>();
  
  // Размеры элементов для виртуализации
  itemSizes: Map<string, number> = new Map();

  constructor() {
    // Используем makeObservable вместо makeAutoObservable для поддержки наследования
    makeObservable(this, {
      sort: observable,
      itemSizes: observable,
      setSort: action,
      setLoaded: action,
      setLoading: action,
      setTotalItems: action,
      setCurrentPage: action,
      updateItemSize: action
    });
  }

  /**
   * Применяет сортировку к списку элементов
   */
  applySorting(items: T[]): T[] {
    return items.sort((a, b) => {
      if (this.sort === 'likes') {
        const likeDiff = (b.likes || 0) - (a.likes || 0);
        if (likeDiff !== 0) return likeDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }

  /**
   * Устанавливает тип сортировки и обновляет коллекции
   */
  setSort(sort: 'date' | 'likes') {
    this.sort = sort;
    this.loadedMap.clear();
    this.applySortToAllCollections();
  }
  
  /**
   * Устанавливает статус загрузки всех элементов
   */
  setLoaded(itemId: string, loaded: boolean) {
    this.loadedMap.set(itemId, loaded);
  }
  
  /**
   * Устанавливает статус загрузки элементов
   */
  setLoading(itemId: string, value: boolean) {
    this.loadingMap.set(itemId, value);
  }
  
  /**
   * Устанавливает общее количество элементов
   */
  setTotalItems(parentId: string, total: number) {
    this.totalItemsMap.set(parentId, total);
  }
  
  /**
   * Устанавливает текущую страницу элементов
   */
  setCurrentPage(parentId: string, page: number) {
    this.currentPageMap.set(parentId, page);
  }

  /**
   * Проверяет, загружены ли все элементы
   */
  hasLoaded(itemId: string): boolean {
    return this.loadedMap.get(itemId) || false;
  }
  
  /**
   * Проверяет, находятся ли элементы в процессе загрузки
   */
  isLoading(itemId: string): boolean {
    return this.loadingMap.get(itemId) || false;
  }
  
  /**
   * Возвращает текущую страницу элементов
   */
  getCurrentPage(itemId: string): number {
    return this.currentPageMap.get(itemId) || 1;
  }
  
  /**
   * Возвращает общее количество элементов
   */
  getTotalItems(itemId: string): number {
    return this.totalItemsMap.get(itemId) || 0;
  }

  /**
   * Обновляет размер элемента для виртуализации
   */
  updateItemSize(itemId: string, height: number) {
    this.itemSizes.set(itemId, height);
  }
  
  /**
   * Возвращает размер элемента для виртуализации
   */
  getItemSize(itemId: string): number {
    return this.itemSizes.get(itemId) || 200; // Значение по умолчанию
  }

  /**
   * Проверяет, лайкнул ли пользователь элемент
   */
  protected isItemLikedByUser(item: T, userId: string): boolean {
    if (!item || !userId) return false;
    
    if (Array.isArray(item.likedUserIds)) {
      return item.likedUserIds.includes(userId);
    }
    
    return false;
  }

  /**
   * Общий метод отправки событий лайка/анлайка на сервер
   */
protected emitLikeEvent(socket: { emit: (event: string, payload: unknown, callback?: (response: unknown) => void) => void }, event: string, payload: unknown): void {
  try {
    socket.emit(event, payload, (response: unknown) => {
      if (response && typeof response === 'object' && 'error' in response) {
        logger.error(`Failed to ${event}:`, (response as { error: unknown }).error);
      } else {
        logger.log(`${event} event sent successfully`);
      }
    });
  } catch (error) {
    logger.error(`Error sending ${event} event:`, error);
  }
}
  
  /**
   * Абстрактные методы, которые должны быть реализованы в наследниках
   */
  abstract toggleLike(itemId: string, userId: string): void;
  abstract getItemById(itemId: string): T | undefined;
  protected abstract applySortToAllCollections(): void;
  
  /**
   * Имплементация метода очистки ресурсов наследниками
   */
  dispose() {
    // По умолчанию ничего не делаем, наследники должны переопределить при необходимости
  }
}