import { action, AnnotationMapEntry, makeObservable, observable } from "mobx";
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
 * Ключевые методы и свойства BaseStore, которые нужно исключать в дочерних классах
 */
export type BaseStoreKeys = 'sort' | 'loadingMap' | 'totalItemsMap' | 'currentPageMap' | 
  'loadedMap' | 'itemSizes' | 'applySorting' | 'setSort' | 'setLoaded' | 'setLoading' | 
  'setTotalItems' | 'setCurrentPage' | 'hasLoaded' | 'isLoading' | 'getCurrentPage' | 
  'getTotalItems' | 'updateItemSize' | 'getItemSize' | 'isItemLikedByUser' | 
  'emitLikeEvent' | 'dispose' | 'applySortToAllCollections'; 

/**
 * Абстрактный базовый класс для хранилищ данных
 */
export abstract class BaseStore<T extends BaseItem> {
  // Настройки сортировки
  sort: 'date' | 'likes' = 'date';
  
  // Карты для хранения служебных данных
  loadingMap = new Map<string, boolean>();
  totalItemsMap = new Map<string, number>();
  currentPageMap = new Map<string, number>();
  loadedMap = new Map<string, boolean>();
  
  // Размеры элементов для виртуализации
  itemSizes: Map<string, number> = new Map();

      constructor() {
    // Используем правильные типы вместо any
    const annotations: {
      // Observable properties
      sort: AnnotationMapEntry;
      loadingMap: AnnotationMapEntry;
      totalItemsMap: AnnotationMapEntry;
      currentPageMap: AnnotationMapEntry;
      loadedMap: AnnotationMapEntry;
      itemSizes: AnnotationMapEntry;
      
      // Actions
      applySorting: AnnotationMapEntry;
      setSort: AnnotationMapEntry;
      setLoaded: AnnotationMapEntry;
      setLoading: AnnotationMapEntry;
      setTotalItems: AnnotationMapEntry;
      setCurrentPage: AnnotationMapEntry;
      hasLoaded: AnnotationMapEntry;
      isLoading: AnnotationMapEntry;
      getCurrentPage: AnnotationMapEntry;
      getTotalItems: AnnotationMapEntry;
      updateItemSize: AnnotationMapEntry;
      getItemSize: AnnotationMapEntry;
    } = {
      // Observable properties
      sort: observable,
      loadingMap: observable,
      totalItemsMap: observable,
      currentPageMap: observable,
      loadedMap: observable,
      itemSizes: observable,
      
      // Actions
      applySorting: action,
      setSort: action,
      setLoaded: action,
      setLoading: action,
      setTotalItems: action,
      setCurrentPage: action,
      hasLoaded: action,
      isLoading: action,
      getCurrentPage: action,
      getTotalItems: action,
      updateItemSize: action,
      getItemSize: action,
    };

    makeObservable(this, annotations);
  }

  /**
   * Применяет сортировку к списку элементов
   */
  applySorting(items: T[]): T[] {
    if (!items || items.length === 0) return items;
    
    // всегда создаем новый массив для сортировки
    const itemsToSort = [...items];
    
    switch (this.sort) {
      case 'likes':
        return itemsToSort.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      case 'date':
      default:
        return itemsToSort.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
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