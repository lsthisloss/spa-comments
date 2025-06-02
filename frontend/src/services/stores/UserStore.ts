import { makeObservable, observable, action, runInAction } from "mobx";
import { socketStore } from "./SocketStore";
import { User } from "../../types/interfaces";
import { IUserStore } from "../../types/stores";
import authStore from "./AuthStore";
import { postStore } from "./PostStore";
import { logger } from "../../utils/Logger";

class UserStore implements IUserStore {
  user: User | null = null;
  isAuthenticated = false;
  usersCache = observable.map<string, User>();
  loadingUsers = observable.set<string>();
  followingUserIds = observable.set<string>(); 

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


// Получить пользователя по ID или slug с кэшированием
async getUserById(userIdOrSlug: string): Promise<User | null> {
    // Проверяем кэш по всем возможным ключам
  let cachedUser = this.usersCache.get(userIdOrSlug);
    
    // Если не нашли по переданному параметру, ищем по всем пользователям в кэше
    if (!cachedUser) {
      for (const [, user] of this.usersCache.entries()) {
        if (user.id === userIdOrSlug || user.slug === userIdOrSlug) {
          cachedUser = user;
          // Кэшируем под новым ключом для быстрого доступа
          this.usersCache.set(userIdOrSlug, user);
          break;
        }
      }
    }
    
    if (cachedUser) {
      return cachedUser;
    }

    // Проверяем, не загружается ли уже
    if (this.loadingUsers.has(userIdOrSlug)) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loadingUsers.has(userIdOrSlug)) {
            clearInterval(checkInterval);
            resolve(this.usersCache.get(userIdOrSlug) || null);
          }
        }, 100);
      });
    }

    // Начинаем загрузку
    runInAction(() => {
      this.loadingUsers.add(userIdOrSlug);
    });

    return new Promise<User | null>((resolve) => {
      if (!socketStore.users) {
        runInAction(() => {
          this.loadingUsers.delete(userIdOrSlug);
        });
        resolve(null);
        return;
      }

      socketStore.users.emit("getUser", { userId: userIdOrSlug }, (res: { success: boolean; user?: User; message?: string }) => {
        runInAction(() => {
          this.loadingUsers.delete(userIdOrSlug);
          
          if (res?.success && res.user) {
            // Инициализируем настройки по умолчанию если их нет
            if (!res.user.settings) {
              res.user.settings = {
                debugMode: false,
              };
            }
            
            // Кэшируем под всеми возможными ключами
            this.usersCache.set(res.user.id, res.user);
            if (res.user.slug) {
              this.usersCache.set(res.user.slug, res.user);
            }
            this.usersCache.set(userIdOrSlug, res.user);
            
            resolve(res.user);
          } else {
            console.error('Failed to get user:', res?.message);
            resolve(null);
          }
        });
      });
  });
}

  setUser(userData: User | null) {
    runInAction(() => {
      this.user = userData;
      this.isAuthenticated = !!userData;
      
      // Проверяем наличие обязательных полей перед кэшированием
      if (userData && userData.id && userData.userName) {
        this.addCachedUser(userData);
      }
      
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        localStorage.removeItem('user');
      }
      
      logger.log(`[UserStore] User set: ${userData ? userData.userName : 'null'}`);
    });
  }

  /**
   * Очищает текущего пользователя
   */
  clearUser() {
    runInAction(() => {
      this.user = null;
      this.isAuthenticated = false;
      // Не очищаем usersCache, чтобы сохранить кэшированных пользователей
      
      localStorage.removeItem('user');
      logger.log('[UserStore] User cleared');
    });
  }

  /**
   * Добавляет пользователя в кэш
   */
  addCachedUser(user: Partial<User>) {
    // Проверяем что у пользователя есть обязательные поля
    if (user && user.id && user.userName) {
      // Создаем полный объект User с дефолтными значениями
      const fullUser: User = {
        id: user.id,
        userName: user.userName,
        email: user.email || '',
        slug: user.slug || user.userName.toLowerCase(),
        avatarUrl: user.avatarUrl || null,
        avatarShape: user.avatarShape || 'circle',
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: user.updatedAt || new Date().toISOString(),
        followers: user.followers || [],
        following: user.following || [],
        ...user // Копируем все остальные поля
      };
      
      this.usersCache.set(user.id, fullUser);
      
      // Также кэшируем по slug если есть
      if (fullUser.slug) {
        this.usersCache.set(fullUser.slug, fullUser);
      }
      
      logger.log(`[UserStore] Cached user ${fullUser.userName}`);
    } else {
      logger.warn(`[UserStore] Cannot cache user - missing required fields:`, user);
    }
  }

  /**
   * Получает пользователя из кэша по ID или slug
   */
  getCachedUser(identifier: string): User | null {
    return this.usersCache.get(identifier) || null;
  }

  // Проверить, загружается ли пользователь (по ID или slug)
  isUserLoading(userIdOrSlug: string): boolean {
    return this.loadingUsers.has(userIdOrSlug);
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
            // Создаем updatedUser сразу с правильными данными
            const preservedSettings = this.user?.settings;
            const preservedAvatarUrl = this.user?.avatarUrl;
            const preservedAvatarShape = this.user?.avatarShape;
            
            const updatedUser: User = {
              ...res.user!,
              settings: preservedSettings || { debugMode: false },
              avatarUrl: res.user!.avatarUrl !== undefined ? res.user!.avatarUrl : preservedAvatarUrl,
              avatarShape: res.user!.avatarShape !== undefined ? res.user!.avatarShape : preservedAvatarShape
            };
            
            runInAction(() => {
              // Обновляем основного пользователя
              this.setUser(updatedUser);
              
              // Обновляем кэш ПРИНУДИТЕЛЬНО со всеми данными
              this.usersCache.set(updatedUser.id, { ...updatedUser });
              if (updatedUser.slug) {
                this.usersCache.set(updatedUser.slug, { ...updatedUser });
              }
              
              // Синхронизируем AuthStore
              if (updateData.userName && authStore.token) {
                authStore.setAuth(authStore.token, updatedUser.id, updatedUser.userName);
              }
            });
            
            if (updateData.userName) {
              setTimeout(() => {
                // Обновить userName в постах всех лент асинхронно
                Object.values(postStore.feeds).forEach(feed => {
                  feed.list.forEach(post => {
                    if (post.userId === updatedUser.id) {
                      runInAction(() => {
                        post.userName = updatedUser.userName;
                        if (post.user && typeof post.user === 'object') {
                          post.user.userName = updatedUser.userName;
                        }
                      });
                    }
                  });
                });
              }, 0);
            }
            
            resolve(updatedUser);
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


private updateUserAvatarInPosts(userId: string, avatarUrl?: string, avatarShape?: string) {
  setTimeout(() => {
    // Обновляем аватары в постах всех лент асинхронно
    Object.values(postStore.feeds).forEach(feed => {
      feed.list.forEach(post => {
        if (post.userId === userId) {
          runInAction(() => {
            // Обновляем аватар в самом посте
            if (avatarUrl !== undefined) {
              post.avatarUrl = avatarUrl;
            }
            if (avatarShape !== undefined) {
              post.avatarShape = avatarShape;
            }
            
            // Обновляем аватар в объекте user если он есть
            if (post.user && typeof post.user === 'object') {
              if (avatarUrl !== undefined) {
                post.user.avatarUrl = avatarUrl;
              }
              if (avatarShape !== undefined) {
                post.user.avatarShape = avatarShape as 'circle' | 'square';
              }
            }
          });
        }
      });
    });
    
    // Также обновляем в сохраненных постах feed
    postStore.feedSavedPosts.forEach(post => {
      if (post.userId === userId) {
        runInAction(() => {
          if (avatarUrl !== undefined) {
            post.avatarUrl = avatarUrl;
          }
          if (avatarShape !== undefined) {
            post.avatarShape = avatarShape;
          }
          
          if (post.user && typeof post.user === 'object') {
            if (avatarUrl !== undefined) {
              post.user.avatarUrl = avatarUrl;
            }
            if (avatarShape !== undefined) {
              post.user.avatarShape = avatarShape as 'circle' | 'square';
            }
          }
        });
      }
    });
  }, 0);
}


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
              const updatedUser: User = {
                ...this.user!,
                avatarUrl: avatarData.type === 'initial' ? undefined : this.user!.avatarUrl,
                avatarShape: res.user ? res.user.avatarShape : this.user!.avatarShape
              };
              
              runInAction(() => {
                this.setUser(updatedUser);
                this.usersCache.set(updatedUser.id, updatedUser);
              });
              
              this.updateUserAvatarInPosts(
                this.user!.id, 
                updatedUser.avatarUrl || undefined, // null становится undefined
                updatedUser.avatarShape
              );
              
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
                  const updatedUser: User = {
                    ...this.user!,
                    avatarUrl: res.user?.avatarUrl ?? this.user!.avatarUrl,
                    avatarShape: res.user?.avatarShape ?? this.user!.avatarShape
                  };
                  
                  runInAction(() => {
                    this.setUser(updatedUser);
                    this.usersCache.set(updatedUser.id, updatedUser);
                  });
                  
                  this.updateUserAvatarInPosts(
                    this.user!.id, 
                    res.user.avatarUrl || undefined, // null становится undefined
                    res.user.avatarShape
                  );
                  
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
  
  /**
     * Проверяет, подписан ли текущий пользователь на указанного пользователя
     * @param userId ID пользователя для проверки
     * @returns true, если подписан, иначе false
     */
    isFollowedByCurrentUser(userId: string): boolean {
      return this.followingUserIds.has(userId);
    }

    /**
     * Обновляет список подписок текущего пользователя
     */
    updateFollowing(userIds: string[]) {
      runInAction(() => {
        this.followingUserIds.replace(userIds);
      });
      logger.log(`[UserStore] Updated following list: ${userIds.length} users`);
    }

  // Вспомогательный метод для конвертации файла в base64
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = error => reject(error);
    });
  }
}

const userStoreInstance = new UserStore();
export default userStoreInstance;