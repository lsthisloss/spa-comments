import { makeObservable, observable, action, runInAction } from "mobx";
import { socketStore } from "./SocketStore";
import { User } from "../../types/interfaces";
import { IUserStore } from "../../types/stores";
import authStore from "./AuthStore";
import { postStore } from "./PostStore";

class UserStore implements IUserStore {
  user: User | null = null;
  isAuthenticated = false;
  
  // Добавляем кэш для загруженных пользователей
  usersCache = observable.map<string, User>();
  loadingUsers = observable.set<string>();

  constructor() {
    makeObservable(this, {
      user: observable,
      isAuthenticated: observable,
      usersCache: observable,
      loadingUsers: observable,
      setUser: action,
      logout: action,
      getUserById: action,
      followUser: action,
      unfollowUser: action,
      updateUserSettings: action,
      updateUser: action,
      deleteUser: action,
    });

    this.loadUserFromStorage();
  }

  setUser(user: User | null) {
    this.user = user;
    this.isAuthenticated = !!user;
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      // Добавляем в кэш
      this.usersCache.set(user.id, user);
    } else {
      localStorage.removeItem("user");
    }
  }

  logout() {
    this.setUser(null);
    
    // Call authStore.logout() to ensure all auth data is cleared
    authStore.logout();
    
    // Clear all user-related localStorage items explicitly
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    
    // Clear users cache
    this.clearUsersCache();
  }

  private loadUserFromStorage() {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser) as User;
        // Инициализируем настройки по умолчанию если их нет
        if (!user.settings) {
          user.settings = {
            debugMode: false,
          };
        }
        this.user = user;
        this.isAuthenticated = true;
        this.usersCache.set(user.id, user);
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem("user");
      }
    }
  }

  updateUserSettings(settings: Partial<User['settings']>) {
    if (!this.user) return;
    
    const updatedUser = {
      ...this.user,
      settings: {
        ...this.user.settings,
        ...settings
      }
    };
    
    this.setUser(updatedUser);
  }

  // Получить пользователя по ID с кэшированием
  async getUserById(userId: string): Promise<User | null> {
    // Проверяем кэш
    if (this.usersCache.has(userId)) {
      return this.usersCache.get(userId)!;
    }

    // Проверяем, не загружается ли уже
    if (this.loadingUsers.has(userId)) {
      // Ждем завершения загрузки
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loadingUsers.has(userId)) {
            clearInterval(checkInterval);
            resolve(this.usersCache.get(userId) || null);
          }
        }, 100);
      });
    }

    // Начинаем загрузку
    runInAction(() => {
      this.loadingUsers.add(userId);
    });

    return new Promise<User | null>((resolve) => {
      if (!socketStore.users) {
        runInAction(() => {
          this.loadingUsers.delete(userId);
        });
        resolve(null);
        return;
      }

      socketStore.users.emit("getUser", { userId }, (res: { success: boolean; user?: User; message?: string }) => {
        runInAction(() => {
          this.loadingUsers.delete(userId);
          
          if (res?.success && res.user) {
            // Инициализируем настройки по умолчанию если их нет
            if (!res.user.settings) {
              res.user.settings = {
                debugMode: false,
              };
            }
            this.usersCache.set(userId, res.user);
            resolve(res.user);
          } else {
            console.error('Failed to get user:', res?.message);
            resolve(null);
          }
        });
      });
    });
  }

  // Проверить, загружается ли пользователь
  isUserLoading(userId: string): boolean {
    return this.loadingUsers.has(userId);
  }

  // Получить пользователя из кэша
  getCachedUser(userId: string): User | null {
    return this.usersCache.get(userId) || null;
  }

  async followUser(userId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!socketStore.users) {
        reject(new Error("Users socket not available"));
        return;
      }

      socketStore.users.emit("followUser", { userId }, (res: { success: boolean; error?: string }) => {
        if (res.success) {
          // Обновляем локальное состояние
          runInAction(() => {
            if (this.user) {
              this.user.following = [...(this.user.following || []), { id: userId } as User];
              localStorage.setItem("user", JSON.stringify(this.user));
            }
            
            // Обновляем кэш пользователя
            const cachedUser = this.usersCache.get(userId);
            if (cachedUser) {
              cachedUser.followers = [...(cachedUser.followers || []), this.user!];
              this.usersCache.set(userId, cachedUser);
            }
          });
          postStore.resetFeedState("following");
          resolve();
        } else {
          reject(new Error(res.error || "Failed to follow user"));
        }
      });
    });
  }

  async unfollowUser(userId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!socketStore.users) {
        reject(new Error("Users socket not available"));
        return;
      }

      socketStore.users.emit("unfollowUser", { userId }, (res: { success: boolean; error?: string }) => {
        if (res.success) {
          // Обновляем локальное состояние
          runInAction(() => {
            if (this.user) {
              this.user.following = (this.user.following || []).filter(u => u.id !== userId);
              localStorage.setItem("user", JSON.stringify(this.user));
            }
            
            // Обновляем кэш пользователя
            const cachedUser = this.usersCache.get(userId);
            if (cachedUser) {
              cachedUser.followers = (cachedUser.followers || []).filter(u => u.id !== this.user?.id);
              this.usersCache.set(userId, cachedUser);
            }
          });
          postStore.resetFeedState("following");
          resolve();
        } else {
          reject(new Error(res.error || "Failed to unfollow user"));
        }
      });
    });
  }

  // Проверить, подписан ли текущий пользователь на другого
  isFollowing(userId: string): boolean {
    if (!this.user) return false;
    return !!(this.user.following || []).some(u => u.id === userId);
  }

  // Очистить кэш пользователей
  clearUsersCache() {
    this.usersCache.clear();
    this.loadingUsers.clear();
  }

  async updateUser(updateData: { userName?: string; email?: string; password?: string }): Promise<User> {
    return new Promise<User>((resolve, reject) => {
      if (!this.user?.id || !socketStore.users) {
        reject(new Error("User not authenticated or socket not available"));
        return;
      }

      socketStore.users?.emit(
        "updateUser", 
        { 
          userId: this.user.id, 
          ...updateData 
        }, 
        (res: { success: boolean; user?: User; message?: string }) => {
          if (res.success && res.user) {
            runInAction(() => {
              // Сохраняем настройки при обновлении
              const preservedSettings = this.user?.settings;
              
              // Обновляем текущего пользователя
              const updatedUser = {
                ...res.user!,
                settings: preservedSettings || { debugMode: false }
              };
              
              this.setUser(updatedUser);
              
              // Обновляем кэш для всех мест, где может отображаться этот пользователь
              this.usersCache.set(updatedUser.id, updatedUser);
              
              // Синхронизируем AuthStore
              if (updateData.userName && authStore.token) {
                authStore.setAuth(authStore.token, updatedUser.id, updatedUser.userName);
              }
              
              if (updateData.userName) {
                // Обновить userName в постах всех лент
                Object.values(postStore.feeds).forEach(feed => {
                  feed.list.forEach(post => {
                    if (post.userId === updatedUser.id) {
                      // Обновить корневое свойство userName
                      post.userName = updatedUser.userName;
                      
                      // Обновить вложенный объект user, если он существует
                      if (post.user && typeof post.user === 'object') {
                        post.user.userName = updatedUser.userName;
                      }
                    }
                  });
                });
              }
              
              resolve(updatedUser);
            });
          } else {
            reject(new Error(res.message || "Failed to update user"));
          }
        }
      );
    });
  }

  async deleteUser(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.user?.id || !socketStore.users) {
        reject(new Error("User not authenticated or socket not available"));
        return;
      }

      if (!socketStore.users) {
        throw new Error("Users socket not available");
      }
      socketStore.users.emit(
        "deleteUser", 
        { userId: this.user.id }, 
        (res: { success: boolean; message?: string }) => {
          if (res.success) {
            // Очищаем пользователя
            runInAction(() => {
              this.setUser(null);
              this.clearUsersCache();
            });
            resolve();
          } else {
            reject(new Error(res.message || "Failed to delete user"));
          }
        }
      );
    });
  }

  // Обновляем метод updateAvatar

async updateAvatar(avatarData: { 
  type: 'upload' | 'initial', 
  value: string, 
  file?: File,
  shape: 'circle' | 'square' 
}): Promise<User | null> {
  if (!this.user?.id || !socketStore.users) {
    throw new Error("User not authenticated or socket not available");
  }

  // Для initial или если нужно только обновить форму аватара
  if (avatarData.type === 'initial' || (avatarData.type === 'upload' && !avatarData.file)) {
    return new Promise<User | null>((resolve, reject) => {      
      if (!socketStore.users) {
        throw new Error("Users socket not available");
      }
      socketStore.users.emit(
        "updateAvatarShape", 
        { avatarShape: avatarData.shape }, 
        (res: { success: boolean; user?: User; message?: string }) => {
          if (res.success && res.user) {
            runInAction(() => {
              const updatedUser = {
                ...this.user!,
                avatarUrl: avatarData.type === 'initial' ? '' : this.user!.avatarUrl,
                avatarShape: res.user ? res.user.avatarShape : this.user!.avatarShape
              };
              
              this.setUser(updatedUser);
              this.usersCache.set(updatedUser.id, updatedUser);
            });
            resolve(res.user);
          } else {
            reject(new Error(res.message || "Failed to update avatar shape"));
          }
        }
      );
    });
  }
  
  // Для загрузки нового файла аватара
  if (avatarData.type === 'upload' && avatarData.file) {
    return new Promise<User | null>((resolve, reject) => {
      if (avatarData.file) {
        this.fileToBase64(avatarData.file)
          .then(base64 => {
        if (!socketStore.users) {
            throw new Error("Users socket not available");
          }
          socketStore.users.emit(
            "uploadAvatar", 
            { 
              file: {
                name: avatarData.file!.name,
                type: avatarData.file!.type,
                base64
              },
              avatarShape: avatarData.shape
            }, 
            (res: { success: boolean; user?: User; message?: string }) => {
              if (res.success && res.user) {
                runInAction(() => {
                  const updatedUser = {
                    ...this.user!,
                    avatarUrl: res.user ? res.user.avatarUrl : this.user!.avatarUrl,
                    avatarShape: res.user?.avatarShape ?? this.user!.avatarShape
                  };
                  
                  this.setUser(updatedUser);
                  this.usersCache.set(updatedUser.id, updatedUser);
                });
                resolve(res.user);
              } else {
                reject(new Error(res.message || "Failed to upload avatar"));
              }
            }
          );
        })
        .catch(error => {
          reject(new Error(`Failed to process image: ${error.message}`));
        });
    }
    });
  }
  
  return Promise.reject(new Error("Invalid avatar data"));
}

// Вспомогательный метод для конвертации файла в base64
private fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      // Удаляем префикс data:image/png;base64, из строки
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = error => reject(error);
  });
}
}

const userStoreInstance = new UserStore();
export default userStoreInstance;