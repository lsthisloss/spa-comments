import { makeObservable, observable, action, computed, runInAction } from "mobx";
import { logger } from "../../utils/Logger";
import { User, UserRole } from "../../types/interfaces";
import AuthStore from "./AuthStore";
import SocketStore from "./SocketStore";
import PostStore from "./PostStore";
import { IUserStore } from "../../types/stores";

class UserStore implements IUserStore {
  user: User | null = null;
  usersCache = observable.map<string, User>();
  loadingUsers = observable.set<string>();
  followingUserIds = observable.set<string>();
  loginLoading = false;
  
  private authStore: AuthStore;
  private socketStore: SocketStore;
  private postStore: PostStore; // PostStore как зависимость

  constructor(authStore: AuthStore, socketStore: SocketStore, postStore: PostStore) {
    this.authStore = authStore;
    this.socketStore = socketStore;
    this.postStore = postStore; // Сохраняем ссылку

    makeObservable(this, {
      user: observable,
      usersCache: observable,
      loadingUsers: observable,
      loginLoading: observable,
      setUser: action,
      logout: action,
      login: action,
      getUserById: action,
      followUser: action,
      unfollowUser: action,
      updateUserSettings: action,
      updateUser: action,
      deleteUser: action,
      register: action,
      // Computed свойства для ролей
      isAuthenticated: computed,
      isAdmin: computed,
      isSuperAdmin: computed,
      canManageAdmins: computed,
      canExecuteDebugTests: computed,
    });

    this.loadUserFromStorage();
  }

  validateUserRole(role: string | undefined): UserRole {
    if (role === 'admin' || role === 'superadmin') {
      return role;
    }
    return 'user'; // По умолчанию
  }

  /**
   * Добавляет пользователя в кэш с валидацией типов
   */
  addCachedUser(user: Partial<User>) {
    // Проверяем что у пользователя есть обязательные поля
    if (user && user.id && user.userName) {
      // Создаем полный объект User с правильными типами
      const fullUser: User = {
        id: user.id,
        userName: user.userName,
        email: user.email || '',
        slug: user.slug || user.userName.toLowerCase(),
        avatarUrl: user.avatarUrl || null,
        avatarShape: user.avatarShape || 'circle',
        role: this.validateUserRole(user.role), // Валидируем роль
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: user.updatedAt || new Date().toISOString(),
        followers: user.followers || [],
        following: user.following || [],
        settings: user.settings || { debugMode: false },
        ...user // Копируем все остальные поля
      };

      this.usersCache.set(user.id, fullUser);

      // Также кэшируем по slug если есть
      if (fullUser.slug) {
        this.usersCache.set(fullUser.slug, fullUser);
      }

      //logger.log(`[UserStore] Cached user ${fullUser.userName} with role: ${fullUser.role}`);
    } else {
      logger.warn(`[UserStore] Cannot cache user - missing required fields:`, user);
    }
  }

  /**
   * Устанавливает пользователя с валидацией типов
   */
  setUser(userData: User | null) {
    runInAction(() => {
      if (userData) {
        // Валидируем роль перед установкой
        const validatedUser: User = {
          ...userData,
          role: this.validateUserRole(userData.role),
          settings: userData.settings || { debugMode: false }
        };

        this.user = validatedUser;

        console.log(`[UserStore] Setting user with role: ${validatedUser.role}`);
        console.log(`[UserStore] Is superadmin: ${this.isSuperAdmin}`);
        console.log(`[UserStore] Can manage admins: ${this.canManageAdmins}`);

        this.addCachedUser(validatedUser);
        localStorage.setItem('user', JSON.stringify(validatedUser));
      } else {
        this.user = null;
        localStorage.removeItem('user');
      }

      logger.log(`[UserStore] User set: ${userData ? userData.userName : 'null'}`);
    });
  }

  /**
   * Загрузка пользователя из localStorage с валидацией
   */
  private loadUserFromStorage() {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const rawUser = JSON.parse(storedUser);

        // Создаем валидного пользователя
        const user: User = {
          id: rawUser.id,
          userName: rawUser.userName,
          email: rawUser.email || '',
          role: this.validateUserRole(rawUser.role), // Валидируем роль
          avatarUrl: rawUser.avatarUrl || null,
          avatarShape: rawUser.avatarShape || 'circle',
          slug: rawUser.slug || '',
          createdAt: rawUser.createdAt || new Date().toISOString(),
          updatedAt: rawUser.updatedAt || new Date().toISOString(),
          followers: rawUser.followers || [],
          following: rawUser.following || [],
          settings: rawUser.settings || { debugMode: false },
        };

        this.user = user;
        this.usersCache.set(user.id, user);

        console.log(`[UserStore] Loaded user from storage with role: ${user.role}`);
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem("user");
      }
    }
  }

  logout() {
    this.setUser(null);
    this.authStore.logout();

    // Отключаем аутентифицированные сокеты
    this.socketStore.disconnectAuthenticatedSockets();

    // Очищаем localStorage
    localStorage.removeItem("user");

    // Очищаем кэш пользователей
    this.clearUsersCache();
  }

  // Computed свойства основаны на this.user
  get isAuthenticated(): boolean {
    return !!this.user && !!this.authStore.token;
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
      if (!this.socketStore.users) {
        runInAction(() => {
          this.loadingUsers.delete(userIdOrSlug);
        });
        resolve(null);
        return;
      }

      this.socketStore.users.emit("getUser", { userId: userIdOrSlug }, (res: { success: boolean; user?: Partial<User>; message?: string }) => {
        runInAction(() => {
          this.loadingUsers.delete(userIdOrSlug);

          if (res?.success && res.user && res.user.id && res.user.userName) {
            // Создаем валидного пользователя
            const validatedUser: User = {
              id: res.user.id, // Теперь точно string
              userName: res.user.userName, // Теперь точно string
              email: res.user.email || '',
              role: this.validateUserRole(res.user.role), // Валидируем роль
              avatarUrl: res.user.avatarUrl || null,
              avatarShape: res.user.avatarShape || 'circle',
              slug: res.user.slug || '',
              createdAt: res.user.createdAt || new Date().toISOString(),
              updatedAt: res.user.updatedAt || new Date().toISOString(),
              followers: res.user.followers || [],
              following: res.user.following || [],
              settings: res.user.settings || { debugMode: false },
            };

            // Кэшируем под всеми возможными ключами
            this.usersCache.set(validatedUser.id, validatedUser);
            if (validatedUser.slug) {
              this.usersCache.set(validatedUser.slug, validatedUser);
            }
            this.usersCache.set(userIdOrSlug, validatedUser);

            resolve(validatedUser);
          } else {
            console.error('Failed to get user - missing required fields:', res?.user);
            resolve(null);
          }
        });
      });
    });
  }


  /**
   * Очищает текущего пользователя
   */
clearUser = action(() => {
  logger.log('[UserStore] Clearing current user data');
  runInAction(() => {
    this.user = null;
  });
  
  // Clear from localStorage
  try {
    localStorage.removeItem('user');
  } catch (e) {
    logger.error('[UserStore] Failed to remove user from localStorage', e);
  }
  
  // Clear following data
  this.followingUserIds.clear();
  
  
  logger.log('[UserStore] User data cleared successfully');
});


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
      if (!this.socketStore.users) {
        reject(new Error("Users socket not available"));
        return;
      }

      this.socketStore.users.emit("followUser", { userId }, (res: { success: boolean; error?: string }) => {
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
          this.postStore.resetFeedsState("following");
          resolve();
        } else {
          reject(new Error(res.error || "Failed to follow user"));
        }
      });
    });
  }

  async unfollowUser(userId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.socketStore.users) {
        reject(new Error("Users socket not available"));
        return;
      }

      this.socketStore.users.emit("unfollowUser", { userId }, (res: { success: boolean; error?: string }) => {
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
          this.postStore.resetFeedsState("following");
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



  async promoteToAdmin(userIdOrSlug: string): Promise<User | null> {
    return new Promise<User | null>((resolve, reject) => {
      if (!this.user?.id || !this.socketStore.users) {
        reject(new Error("User not authenticated or socket not available"));
        return;
      }

      if (this.user.role !== 'superadmin') {
        reject(new Error("Only SuperAdmin can promote users to Admin"));
        return;
      }

      this.socketStore.users.emit(
        "promoteToAdmin",
        { userId: userIdOrSlug },
        (res: { success: boolean; user?: Partial<User>; message?: string }) => {
          if (res.success && res.user) {
            // Создаем полного пользователя или обновляем существующего
            let updatedUser: User;
            const cachedUser = this.getCachedUser(userIdOrSlug);

            if (cachedUser) {
              // Обновляем существующего пользователя
              updatedUser = {
                ...cachedUser,
                role: 'admin' as UserRole
              };
            } else if (res.user.id && res.user.userName) {
              // Создаем нового пользователя
              updatedUser = {
                id: res.user.id,
                userName: res.user.userName,
                email: res.user.email || '',
                role: 'admin' as UserRole,
                avatarUrl: res.user.avatarUrl || null,
                avatarShape: res.user.avatarShape || 'circle',
                slug: res.user.slug || '',
                createdAt: res.user.createdAt || new Date().toISOString(),
                updatedAt: res.user.updatedAt || new Date().toISOString(),
                followers: res.user.followers || [],
                following: res.user.following || [],
                settings: res.user.settings || { debugMode: false },
              };
            } else {
              reject(new Error("Invalid user data received"));
              return;
            }

            runInAction(() => {
              // Кэшируем обновленного пользователя
              this.usersCache.set(updatedUser.id, updatedUser);
              if (updatedUser.slug) {
                this.usersCache.set(updatedUser.slug, updatedUser);
              }
              this.usersCache.set(userIdOrSlug, updatedUser);
            });

            logger.log(`[UserStore] User ${userIdOrSlug} promoted to Admin`);
            resolve(updatedUser);
          } else {
            reject(new Error(res.message || "Failed to promote user"));
          }
        }
      );
    });
  }

  async demoteFromAdmin(userIdOrSlug: string): Promise<User | null> {
    return new Promise<User | null>((resolve, reject) => {
      if (!this.user?.id || !this.socketStore.users) {
        reject(new Error("User not authenticated or socket not available"));
        return;
      }

      if (this.user.role !== 'superadmin') {
        reject(new Error("Only SuperAdmin can demote Admins"));
        return;
      }

      this.socketStore.users.emit(
        "demoteFromAdmin",
        { userId: userIdOrSlug },
        (res: { success: boolean; user?: Partial<User>; message?: string }) => {
          if (res.success && res.user) {
            // Создаем полного пользователя или обновляем существующего
            let updatedUser: User;
            const cachedUser = this.getCachedUser(userIdOrSlug);

            if (cachedUser) {
              // Обновляем существующего пользователя
              updatedUser = {
                ...cachedUser,
                role: 'user' as UserRole
              };
            } else if (res.user.id && res.user.userName) {
              // Создаем нового пользователя
              updatedUser = {
                id: res.user.id,
                userName: res.user.userName,
                email: res.user.email || '',
                role: 'user' as UserRole,
                avatarUrl: res.user.avatarUrl || null,
                avatarShape: res.user.avatarShape || 'circle',
                slug: res.user.slug || '',
                createdAt: res.user.createdAt || new Date().toISOString(),
                updatedAt: res.user.updatedAt || new Date().toISOString(),
                followers: res.user.followers || [],
                following: res.user.following || [],
                settings: res.user.settings || { debugMode: false },
              };
            } else {
              reject(new Error("Invalid user data received"));
              return;
            }

            runInAction(() => {
              // Кэшируем обновленного пользователя
              this.usersCache.set(updatedUser.id, updatedUser);
              if (updatedUser.slug) {
                this.usersCache.set(updatedUser.slug, updatedUser);
              }
              this.usersCache.set(userIdOrSlug, updatedUser);
            });

            logger.log(`[UserStore] User ${userIdOrSlug} demoted from Admin`);
            resolve(updatedUser);
          } else {
            reject(new Error(res.message || "Failed to demote admin"));
          }
        }
      );
    });
  }

  async login(email: string, password: string): Promise<{
    success: boolean;
    message?: string;
    user?: User;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.socketStore.users) {
        reject(new Error("Users socket not available"));
        return;
      }

      runInAction(() => {
        this.loginLoading = true;
      });

      // Удаляем старый обработчик если есть
      if (this.socketStore.users) {
        this.socketStore.users.off('loginResponse');
      }

      // Устанавливаем обработчик ответа
      this.socketStore.users.on('loginResponse', async (response: {
        success: boolean;
        token?: string;
        user?: Partial<User>;
        message?: string;
      }) => {
        runInAction(() => {
          this.loginLoading = false;
        });

        logger.log('[UserStore] Login response received:', response);

        if (response.success && response.token && response.user && response.user.id && response.user.userName) {
          // Создаем валидного пользователя
          const validatedUser: User = {
            id: response.user.id,
            userName: response.user.userName,
            email: response.user.email || '',
            role: this.validateUserRole(response.user.role),
            avatarUrl: response.user.avatarUrl || null,
            avatarShape: response.user.avatarShape || 'circle',
            slug: response.user.slug || '',
            createdAt: response.user.createdAt || new Date().toISOString(),
            updatedAt: response.user.updatedAt || new Date().toISOString(),
            followers: response.user.followers || [],
            following: response.user.following || [],
            settings: response.user.settings || { debugMode: false },
          };

          // Устанавливаем пользователя
          this.setUser(validatedUser);

          // Устанавливаем токен в AuthStore с дополнительными данными
         this.authStore.setAuth(response.token, validatedUser.id, validatedUser.userName);

          // Инициализируем аутентифицированные сокеты
          try {
            logger.log('[UserStore] Initializing authenticated sockets...');
            await this.socketStore.initializeAuthenticatedSockets(response.token);
            logger.log('[UserStore] Authenticated sockets initialized successfully');
          } catch (error) {
            logger.error('[UserStore] Failed to initialize authenticated sockets:', error);
          }

          // Убираем обработчик после использования
          if (this.socketStore.users) {
            this.socketStore.users.off('loginResponse');
          }

          resolve({
            success: true,
            user: validatedUser
          });
        } else {
          // Убираем обработчик после ошибки
          if (this.socketStore.users) {
            this.socketStore.users.off('loginResponse');
          }

          resolve({
            success: false,
            message: response.message || 'Login failed - invalid user data'
          });
        }
      });

      // Отправляем запрос авторизации
      this.socketStore.users.emit('login', { email, password });
    });
  }

  async register(email: string, userName: string, password: string): Promise<{
    success: boolean;
    message?: string;
    user?: User;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.socketStore.users) {
        reject(new Error("Users socket not available"));
        return;
      }

      runInAction(() => {
        this.loginLoading = true;
      });

      this.socketStore.users.emit('register',
        { email, userName, password },
        async (response: {
          success: boolean;
          token?: string;
          user?: Partial<User>;
          message?: string;
        }) => {
          runInAction(() => {
            this.loginLoading = false;
          });

          logger.log('[UserStore] Register response:', response);

          if (response.success && response.token && response.user && response.user.id && response.user.userName) {
            // Создаем валидного пользователя
            const validatedUser: User = {
              id: response.user.id,
              userName: response.user.userName,
              email: response.user.email || '',
              role: this.validateUserRole(response.user.role),
              avatarUrl: response.user.avatarUrl || null,
              avatarShape: response.user.avatarShape || 'circle',
              slug: response.user.slug || '',
              createdAt: response.user.createdAt || new Date().toISOString(),
              updatedAt: response.user.updatedAt || new Date().toISOString(),
              followers: response.user.followers || [],
              following: response.user.following || [],
              settings: response.user.settings || { debugMode: false },
            };

            // Устанавливаем пользователя
            this.setUser(validatedUser);

            // Устанавливаем токен в AuthStore с дополнительными данными
            this.authStore.setAuth(response.token, validatedUser.id, validatedUser.userName);

            // Инициализируем аутентифицированные сокеты
            try {
              logger.log('[UserStore] Initializing authenticated sockets after registration...');
              await this.socketStore.initializeAuthenticatedSockets(response.token);
              logger.log('[UserStore] Authenticated sockets initialized successfully after registration');
            } catch (error) {
              logger.error('[UserStore] Failed to initialize authenticated sockets after registration:', error);
            }

            resolve({
              success: true,
              user: validatedUser
            });
          } else {
            resolve({
              success: false,
              message: response.message || 'Registration failed - invalid user data'
            });
          }
        }
      );
    });
  }


  async updateUser(updateData: { userName?: string; email?: string; password?: string }): Promise<User> {
    return new Promise<User>((resolve, reject) => {
      if (!this.user?.id || !this.socketStore.users) {
        reject(new Error("User not authenticated or socket not available"));
        return;
      }

      this.socketStore.users?.emit(
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

              // Синхронизируем AuthStore с обновленными данными пользователя
              if (this.authStore.token) {
                this.authStore.setAuth(this.authStore.token, updatedUser.id, updatedUser.userName);
              }
            });

            if (updateData.userName) {
              setTimeout(() => {
                // Обновить userName в постах всех лент асинхронно
                Object.values(this.postStore.feeds).forEach(feed => {
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
      if (!this.user?.id || !this.socketStore.users) {
        reject(new Error("User not authenticated or socket not available"));
        return;
      }

      if (!this.socketStore.users) {
        throw new Error("Users socket not available");
      }
      this.socketStore.users.emit(
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
      Object.values(this.postStore.feeds).forEach(feed => {
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
      this.postStore.feedSavedPosts.forEach(post => {
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
    if (!this.user?.id || !this.socketStore.users) {
      throw new Error("User not authenticated or socket not available");
    }

    // Для initial или если нужно только обновить форму аватара
    if (avatarData.type === 'initial' || (avatarData.type === 'upload' && !avatarData.file)) {
      return new Promise<User | null>((resolve, reject) => {
        if (!this.socketStore.users) {
          throw new Error("Users socket not available");
        }
        this.socketStore.users.emit(
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
              if (!this.socketStore.users) {
                throw new Error("Users socket not available");
              }
              this.socketStore.users.emit(
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


  get isAdmin(): boolean {
    return this.user?.role === 'admin' || this.user?.role === 'superadmin';
  }

  get isSuperAdmin(): boolean {
    return this.user?.role === 'superadmin';
  }

  get canManageAdmins(): boolean {
    return this.user?.role === 'superadmin';
  }

  get canExecuteDebugTests(): boolean {
    return this.user?.role === 'admin' || this.user?.role === 'superadmin';
  }
  async getAllUsers(): Promise<User[]> {
    return new Promise<User[]>((resolve, reject) => {
      if (!this.socketStore.users) {
        reject(new Error("Users socket not available"));
        return;
      }

      this.socketStore.users.emit("getAllUsers", {}, (res: { success: boolean; users?: User[]; message?: string }) => {
        if (res.success && res.users) {
          logger.log(`[UserStore] Found ${res.users.length} users:`, res.users.map(u => `${u.userName} (${u.slug})`));
          resolve(res.users);
        } else {
          reject(new Error(res.message || "Failed to get users"));
        }
      });
    });
  }

  /**
   * Ищет пользователей по запросу
   */
  async searchUsers(query: string): Promise<User[]> {
    return new Promise<User[]>((resolve, reject) => {
      if (!this.socketStore.users) {
        reject(new Error("Users socket not available"));
        return;
      }

      this.socketStore.users.emit("searchUsers", { query }, (res: { success: boolean; users?: User[]; message?: string }) => {
        if (res.success && res.users) {
          logger.log(`[UserStore] Search results for "${query}":`, res.users.map(u => `${u.userName} (${u.slug})`));
          resolve(res.users);
        } else {
          reject(new Error(res.message || "Failed to search users"));
        }
      });
    });
  }
}

export default UserStore;