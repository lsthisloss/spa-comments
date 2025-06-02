import { logger } from "../../utils/Logger";
import { APIResponse, SocketResponse } from "./types";
import  io  from "socket.io-client";

// Получаем тип Socket из возвращаемого значения io()
type SocketType = ReturnType<typeof io>;

export abstract class BaseAPI {
  protected socketNamespace: string;
  protected defaultTimeout = 10000;

  constructor(socketNamespace: string) {
    this.socketNamespace = socketNamespace;
  }

  protected abstract getSocket(): SocketType | null;

  protected async request<T>(
    event: string, 
    data: Record<string, unknown> = {},
    timeout: number = this.defaultTimeout
  ): Promise<APIResponse<T>> {
    return new Promise((resolve, reject) => {
      const socket = this.getSocket();
      
      if (!socket?.connected) {
        reject(new Error(`${this.socketNamespace} socket not connected`));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout: ${event}`));
      }, timeout);

      logger.log(`[${this.socketNamespace}API] ${event}:`, data);

      socket.emit(event, data, (response: SocketResponse) => {
        clearTimeout(timeoutId);
        
        logger.log(`[${this.socketNamespace}API] ${event} response:`, response);
        
        const normalizedResponse = this.normalizeResponse<T>(response);
        
        if (normalizedResponse.success) {
          resolve(normalizedResponse);
        } else {
          reject(new Error(normalizedResponse.error || 'Request failed'));
        }
      });
    });
  }

  protected normalizeResponse<T>(response: SocketResponse): APIResponse<T> {
    // Если это массив - оборачиваем
    if (Array.isArray(response)) {
      return {
        success: true,
        data: response as T,
        total: response.length
      };
    }

    // Если объект с данными
    if (response && typeof response === 'object') {
      // Извлекаем данные в зависимости от типа ответа
      let data: unknown;
      if ('posts' in response && response.posts) {
        data = response.posts;
      } else if ('post' in response && response.post) {
        data = response.post;
      } else if ('comments' in response && response.comments) {
        data = response.comments;
      } else if ('comment' in response && response.comment) {
        data = response.comment;
      } else if ('user' in response && response.user) {
        data = response.user;
      } else if ('data' in response) {
        data = response.data;
      } else {
        data = response;
      }

      return {
        success: response.success !== false,
        data: data as T,
        error: response.error,
        message: response.message,
        // Безопасное обращение к total и page через проверку
        total: 'total' in response && typeof response.total === 'number' ? response.total : undefined,
        page: 'page' in response && typeof response.page === 'number' ? response.page : undefined
      };
    }

    // Простое значение
    return {
      success: true,
      data: response as T
    };
  }
}