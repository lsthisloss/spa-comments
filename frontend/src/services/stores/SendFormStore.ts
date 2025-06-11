import { makeObservable, observable, action, runInAction } from 'mobx';
import { message } from 'antd';
import { logger } from "../../utils/Logger";
import { SendData } from '../../types/interfaces';
import { FileUtils } from '../../utils/FileUtils';
import { ContentSanitizer } from '../../utils/ContentSanitizer';
import { IdResolver } from '../../utils/IdResolver';
import SocketStore from './SocketStore';
import UserStore from './UserStore';

/*
  SendFormStore - хранилище для управления состоянием формы отправки сообщений.
  Позволяет отправлять посты и комментарии, управлять файлами и изображениями,
  а также обрабатывать капчу и сообщения об успехе/ошибке.
*/

class SendFormStore {
  text = "";
  imagePreview: string | null = null;
  selectedFile: File | null = null;
  selectedImageFile: File | null = null;
  captchaVisible = false;
  successMessage = "";
  errorMessage = "";
  loading = false;
  userId = "";
  userName = "";
  dragActive = false;
  avatarUrl: string | null = null;
  avatarShape: 'circle' | 'square' = 'circle';
  captchaVerified = false;

  // Связанные сторы
  private socketStore: SocketStore;
  private userStore: UserStore;

  // Инициализация пользователя
  constructor(socketStore: SocketStore, userStore: UserStore) {
    this.socketStore = socketStore;
    this.userStore = userStore;

    makeObservable(this, {
      //Обсервируемые свойства
      text: observable,
      imagePreview: observable,
      selectedFile: observable,
      selectedImageFile: observable,
      captchaVisible: observable,
      successMessage: observable,
      errorMessage: observable,
      loading: observable,
      dragActive: observable,
      avatarUrl: observable,
      avatarShape: observable,
      captchaVerified: observable,

      //Екшн методы
      setText: action,
      setImagePreview: action,
      setSelectedFile: action,
      setSelectedImageFile: action,
      setCaptchaVisible: action,
      setSuccess: action,
      setError: action,
      setSuccessMessage: action,
      setErrorMessage: action,
      setLoading: action,
      setDragActive: action,
      resetForm: action,
      clearMessages: action,
      handleImageUpload: action,
      handleFileUpload: action,
      handleDragDrop: action,
      initializeUser: action,
      setCaptchaVerified: action,
    });

    // Инициализируем пользователя из userStore
    this.setupUserListener();

  }

  private showOptimisticMessage(type: "post" | "comment", hasAttachments: boolean): (success: boolean, finalMessage?: string, extraData?: { postId?: string; queued?: boolean }) => void {
    const messageKey = `optimistic-${type}-${Date.now()}`;

    // Определяем текст сообщения
    const getMessageText = () => {
      if (type === "post") {
        return hasAttachments ? "📤 Publishing post with attachments..." : "📤 Publishing post...";
      } else {
        return hasAttachments ? "💬 Adding comment with attachments..." : "💬 Adding comment...";
      }
    };

    // Показываем loading сообщение
    message.loading({
      content: getMessageText(),
      key: messageKey,
      duration: 0, // Не исчезает автоматически
    });

    // Возвращаем функцию для обновления сообщения
    return (success: boolean, finalMessage?: string, extraData?: { postId?: string; queued?: boolean }) => {
      if (success) {
        // Адаптируем сообщения под разные форматы ответов
        let successMessage = "";

        if (type === "post") {
          // Для постов показываем детальную информацию
          if (extraData?.queued) {
            successMessage = `Post added successfully!`;
          } else {
            successMessage = finalMessage || `Post added successfully!`;
          }
        } else {
          // Для комментариев - более простое сообщение
          if (finalMessage?.includes("queue")) {
            successMessage = "Comment added successfully!";
          } else {
            successMessage = finalMessage || "Comment added successfully!";
          }
        }

        message.success({
          content: successMessage,
          key: messageKey,
          duration: type === "post" ? 4 : 3, // Посты показываем дольше
        });
      } else {
        message.error({
          content: finalMessage || (type === "post" ? "❌ Failed to publish post" : "❌ Failed to add comment"),
          key: messageKey,
          duration: 4,
        });
      }
    };
  }

  /*
    Инициализация пользователя из userStore.
    Слушает изменения пользователя и обновляет данные в SendFormStore.
  */
  private setupUserListener() {
    // Слушаем изменения в userStore
    if (this.userStore && this.userStore.user) {
      // Реагируем на изменения пользователя в userStore
      const updateFromUserStore = () => {
        if (this.userStore.user) {
          this.initializeUser(
            this.userStore.user.id,
            this.userStore.user.userName,
            this.userStore.user.avatarUrl ?? undefined,
            this.userStore.user.avatarShape
          );
        }
      };

      // Вызываем сразу для инициализации
      updateFromUserStore();

      // Автоматически обновляем при изменении пользователя
      if (this.socketStore.users) {
        this.socketStore.users.on('avatarUploaded', (response: {
          success: boolean;
          user?: {
            id: string;
            userName: string;
            avatarUrl?: string;
            avatarShape?: string;
          };
          avatarUrl?: string;
          avatarShape?: string;
        }) => {
          console.log('[SendFormStore] Avatar updated event received:', response);

          if (response.success && response.user && this.userStore.user) {
            // Обновляем данные формы из события
            this.initializeUser(
              response.user.id,
              response.user.userName,
              response.user.avatarUrl ?? response.avatarUrl,
              (response.user.avatarShape ?? response.avatarShape) as 'circle' | 'square'
            );
          }
        });

        // Также слушаем обновления формы аватара
        this.socketStore.users.on('avatarShapeUpdated', (response: {
          success: boolean;
          user?: {
            id: string;
            userName: string;
            avatarUrl?: string;
            avatarShape?: string;
          };
        }) => {
          console.log('[SendFormStore] Avatar shape updated event received:', response);

          // Если событие содержит пользователя, обновляем данные
          if (response.success && response.user && this.userStore.user) {
            this.initializeUser(
              response.user.id,
              response.user.userName,
              response.user.avatarUrl,
              response.user.avatarShape as 'circle' | 'square'
            );
          }
        });
      }
    }
  }

  /*
    Инициализация пользователя с проверкой на необходимость обновления.
    Обновляет данные пользователя только если они изменились.
  */
  initializeUser = action((userId: string, userName: string, avatarUrl?: string, avatarShape?: 'circle' | 'square') => {
    // Проверяем, нужно ли обновлять данные
    const needsUpdate =
      this.userId !== userId ||
      this.userName !== userName ||
      this.avatarUrl !== (avatarUrl || null) ||
      this.avatarShape !== (avatarShape || 'circle');

    if (!needsUpdate) {
      console.log('[SendFormStore] No update needed, data is the same');
      return; // Не обновляем, если данные не изменились
    }

    console.log('[SendFormStore] Updating user data:', {
      from: { userId: this.userId, userName: this.userName, avatarUrl: this.avatarUrl, avatarShape: this.avatarShape },
      to: { userId, userName, avatarUrl, avatarShape }
    });
    // Обновляем данные пользователя
    this.userId = userId;
    this.userName = userName;
    this.avatarUrl = avatarUrl || null;
    this.avatarShape = avatarShape || 'circle';
  });

  // Сеттеры
  setCaptchaVerified = (value: boolean) => {
    this.captchaVerified = value;
  };

  setText = action((value: string) => {
    this.text = value;
    this.clearMessages();
  });

  setImagePreview = action((value: string | null) => {
    this.imagePreview = value;
  });

  setSelectedFile = action((file: File | null) => {
    this.selectedFile = file;
    this.clearMessages();
  });

  setSelectedImageFile = action((file: File | null) => {
    this.selectedImageFile = file;
  });

  setCaptchaVisible = action((value: boolean) => {
    this.captchaVisible = value;
  });

  setSuccess = action((message: string) => {
    this.successMessage = message;
    this.errorMessage = "";
  });

  setError = action((message: string) => {
    this.errorMessage = message;
    this.successMessage = "";
  });

  // Методы для прямого управления сообщениями
  setSuccessMessage = action((message: string) => {
    this.successMessage = message;
  });

  setErrorMessage = action((message: string) => {
    this.errorMessage = message;
  });

  setLoading = action((value: boolean) => {
    this.loading = value;
  });

  setDragActive = action((value: boolean) => {
    this.dragActive = value;
  });

  clearMessages = action(() => {
    this.successMessage = "";
    this.errorMessage = "";
  });

  resetForm = action(() => {
    this.text = "";
    this.imagePreview = null;
    this.selectedFile = null;
    this.selectedImageFile = null;
    this.captchaVisible = false;
    this.successMessage = "";
    this.errorMessage = "";
    this.loading = false;
    this.dragActive = false;
  });

  // Обработчики файлов используют вынесенные методы
  handleImageUpload = action((file: File) => {
    if (!FileUtils.validateImageFile(file)) {
      return;
    }

    FileUtils.resizeImageToFit(file, (resizedDataUrl) => {
      runInAction(() => {
        this.selectedImageFile = file;
        this.imagePreview = resizedDataUrl;
        this.clearMessages();
      });
      message.success('Image uploaded successfully.');
    });
  });

  handleFileUpload = action((file: File) => {
    if (!FileUtils.validateTextFile(file)) {
      return;
    }

    runInAction(() => {
      this.selectedFile = file;
      this.clearMessages();
    });
    message.success('File uploaded successfully.');
  });

  handleDragDrop = action((file: File) => {
    const fileType = FileUtils.getFileType(file);

    if (fileType === 'image') {
      if (this.selectedImageFile) {
        message.warning('Replacing existing image');
      }
      this.handleImageUpload(file);
    } else if (fileType === 'text') {
      if (this.selectedFile) {
        message.warning('Replacing existing file');
      }
      this.handleFileUpload(file);
    } else {
      message.error(`Unsupported file type. Please upload an image (JPG, PNG, GIF) or text file (.txt).`);
    }
  });

  // Методы отправки данных
  private shouldShowCaptcha(): boolean {
    const isAdmin = (this.userStore && this.userStore.user?.role === 'admin') ||
      (this.userStore && this.userStore.user?.role === 'superadmin');

    return !isAdmin && !this.captchaVerified;
  }

  private prepareBaseData(
    type: "post" | "comment",
    resolvedIds: { parentId?: string; postId?: string }
  ): SendData {
    const { sanitized } = ContentSanitizer.sanitizeContent(this.text);
    if (!sanitized || sanitized.trim() === "") {
      logger.error("[SendFormStore] Invalid content: empty or not sanitized");
      throw new Error("Invalid content");
    }

    // Формируем базовые данные
    const baseData: SendData = {
      userId: this.userId,
      content: sanitized,
      userName: this.userName,
      postId: resolvedIds.postId,
      parentId: resolvedIds.parentId,
      image: { name: '', type: '', base64: '' }
    };

    // Настройка для комментариев
    if (type === "comment") {
      if (resolvedIds.parentId && !resolvedIds.postId) {
        // Ответ на комментарий
        baseData.parentId = resolvedIds.parentId;
      } else if (resolvedIds.parentId && resolvedIds.postId) {
        // Вложенный комментарий
        baseData.parentId = resolvedIds.parentId;
        baseData.postId = resolvedIds.postId;
      } else if (resolvedIds.postId) {
        // Комментарий к посту
        baseData.postId = resolvedIds.postId;
      }
    }
    logger.log("[SendFormStore] Prepared base data:", baseData);

    return baseData;
  }

  private emitData(
    type: "post" | "comment",
    baseData: SendData,
    onSuccess?: () => void
  ): void {
    const socket = this.socketStore[type === "post" ? "posts" : "comments"];

    // Показываем оптимистичное сообщение
    const hasAttachments = !!(this.selectedImageFile || this.selectedFile);
    const updateOptimisticMessage = this.showOptimisticMessage(type, hasAttachments);

    // Добавляем роль пользователя для серверной проверки
    const dataWithRole = {
      ...baseData,
      userRole: this.userStore?.user?.role || 'user'
    };

    if (!socket) {
      runInAction(() => {
        this.setLoading(false);
        updateOptimisticMessage(false, "Connection error. Please try again.");
      });
      return;
    }

    // Отправляем данные через WebSocket  
    socket.emit(
      type === "post" ? "addPost" : "addComment",
      dataWithRole,
      (ack: { success: boolean; message?: string; postId?: string; queued?: boolean;[key: string]: unknown }) => {
        runInAction(() => {
          this.setLoading(false);

          if (ack.success) {
            //  Передаем все данные ответа для адаптации сообщения
            updateOptimisticMessage(true, ack.message, {
              postId: ack.postId,
              queued: ack.queued,
              ...ack
            });
            onSuccess?.();
            this.resetForm();
          } else {
            updateOptimisticMessage(false, ack.message);
          }
        });
      }
    );

    const eventName = type === "post" ? "postAdded" : "commentAdded";

    const handleSuccess = (response: { success?: boolean; message?: string; postId?: string; commentId?: string }) => {
      console.log(`[SendFormStore] Received ${eventName} event:`, response);

      if (response && response.success !== false) {
        // Показываем дополнительное сообщение о queue с задержкой
        setTimeout(() => {
          if (type === "post" && response.postId) {
            message.info({
              content: `📦 Post ${response.postId.slice(0, 8)}... added to processing queue`,
              duration: 2,
            });
          } else if (type === "comment" && response.commentId) {
            message.info({
              content: `📦 Comment ${response.commentId.slice(0, 8)}... added to processing queue`,
              duration: 2,
            });
          } else {
            message.info({
              content: type === "post"
                ? "📦 Post added to processing queue"
                : "📦 Comment added to processing queue",
              duration: 2,
            });
          }
        }, 1500); // Увеличили задержку чтобы не конфликтовать с основным сообщением
      }
    };

    // Слушаем событие один раз
    socket.once(eventName, handleSuccess);

    // Убираем слушатель через таймаут для предотвращения утечек памяти
    setTimeout(() => {
      socket.off(eventName, handleSuccess);
    }, 10000);
  }

  /*
    Обрабатывает вложения (изображение и файл) и возвращает данные для отправки.
    Если есть изображение, оно конвертируется в base64.
    Если есть файл, он также конвертируется в base64.
    Возвращает объект SendData с вложениями.
  */
  private async handleAttachments(baseData: SendData): Promise<SendData> {
    if (this.selectedImageFile && this.selectedFile) {
      // И изображение, и файл
      const imageBase64 = this.imagePreview!.split(",")[1];
      const fileBase64 = await FileUtils.readFileAsBase64(this.selectedFile);

      return {
        ...baseData,
        image: {
          name: this.selectedImageFile.name,
          type: this.selectedImageFile.type,
          base64: imageBase64
        },
        file: {
          name: this.selectedFile.name,
          type: this.selectedFile.type,
          base64: fileBase64
        }
      };
    }
    else if (this.selectedImageFile && this.imagePreview) {
      // Только изображение
      const base64 = this.imagePreview.split(",")[1];

      return {
        ...baseData,
        image: {
          name: this.selectedImageFile.name,
          type: this.selectedImageFile.type,
          base64: base64
        }
      };
    }
    else if (this.selectedFile) {
      // Только файл
      const base64 = await FileUtils.readFileAsBase64(this.selectedFile);

      return {
        ...baseData,
        file: {
          name: this.selectedFile.name,
          type: this.selectedFile.type,
          base64: base64
        }
      };
    }

    // Только текст
    return baseData;
  }

  /**
   * Отправляет данные на сервер.
   */
  async send(
    type: "post" | "comment",
    parentIdOrPostId?: string,
    postIdForNestedComment?: string,
    onSuccess?: () => void,
    parentSlug?: string,
    postSlug?: string
  ) {
    logger.log(`[SendFormStore] send called with: type=${type}, parentSlug=${parentSlug}, postSlug=${postSlug}`);

    // 1. Проверяем наличие контента
    if (!this.text.trim() && !this.selectedImageFile && !this.selectedFile) {
      message.warning("Please enter some text, upload an image, or attach a file.");
      return;
    }

    // 2. Проверяем необходимость капчи
    if (this.shouldShowCaptcha()) {
      runInAction(() => {
        this.setCaptchaVisible(true);
      });
      return;
    }

    // 3. Проверяем текст на валидность
    const { valid, error } = ContentSanitizer.sanitizeContent(this.text);
    if (!valid) {
      message.error(error || "Invalid content");
      return;
    }

    // 4. Проверяем пользователя
    if (!this.userId || this.userId.trim() === '') {
      message.error("You must be logged in to post.");
      return;
    }

    // 5. Проверяем соединение
    const socket = this.socketStore[type === "post" ? "posts" : "comments"];
    if (!socket) {
      message.error("Connection error. Please try again.");
      return;
    }

    // 6. Устанавливаем состояние загрузки
    runInAction(() => {
      this.setLoading(true);
    });

    // 7. Сбрасываем флаг капчи, если это не админ
    const isAdmin = (this.userStore && this.userStore.user?.role === 'admin') ||
      (this.userStore && this.userStore.user?.role === 'superadmin');

    this.setCaptchaVerified(isAdmin);

    try {
      // 8. Получаем ID из слагов
      const resolved = IdResolver.resolveIds(
        type,
        parentIdOrPostId,
        postIdForNestedComment,
        parentSlug,
        postSlug
      );

      if (resolved.error) {
        runInAction(() => {
          this.setLoading(false);
        });
        message.error(resolved.error || "An error occurred");
        return;
      }

      // 9. Подготавливаем данные для отправки
      const baseData = this.prepareBaseData(type, resolved);

      // 10. Логируем отправляемые данные
      logger.log(`[SendFormStore] Sending ${type} with data:`, {
        parentId: baseData.parentId,
        postId: baseData.postId
      });

      // 11. Добавляем вложения
      const dataWithAttachments = await this.handleAttachments(baseData);

      // 12. Отправляем данные (оптимистичные сообщения внутри emitData)
      this.emitData(type, dataWithAttachments, onSuccess);
    } catch (error) {
      runInAction(() => {
        this.setLoading(false);
      });
      message.error("An error occurred while posting");
      logger.error("Send error:", error);
    }
  }
}

export default SendFormStore;