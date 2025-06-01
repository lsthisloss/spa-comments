import { makeObservable, observable, action, runInAction } from 'mobx';
import { message } from 'antd';
import { socketStore } from './SocketStore';
import { logger } from "../../utils/Logger";
import { BaseData } from '../../types/interfaces';
import { postStore } from './PostStore';
import { commentStore } from './CommentStore';

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
  MAX_TEXT_LENGTH = 1000;
  dragActive = false;
  avatarUrl: string | null = null;
  avatarShape: 'circle' | 'square' = 'circle';

  // Разрешенные HTML теги
  private readonly ALLOWED_TAGS = ['b', 'i', 'u', 'br'];

  constructor() {
    makeObservable(this, {
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
      setText: action,
      setImagePreview: action,
      setSelectedFile: action,
      setSelectedImageFile: action,
      setCaptchaVisible: action,
      setSuccess: action,
      setError: action,
      setLoading: action,
      setDragActive: action,
      resetForm: action,
      clearMessages: action,
      handleImageUpload: action,
      handleFileUpload: action,
      handleDragDrop: action,
      initializeUser: action,
    });
  }

  initializeUser = (userId: string, userName: string, avatarUrl?: string, avatarShape?: 'circle' | 'square') => {
    this.userId = userId;
    this.userName = userName;
    this.avatarUrl = avatarUrl || null;
    this.avatarShape = avatarShape || 'circle';
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

  // Валидация изображения
  validateImageFile(file: File): boolean {
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'];
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      message.error(`Invalid image format. Only JPG, PNG, and GIF files are allowed.`);
      return false;
    }

    const maxImageSize = 10 * 1024 * 1024;
    if (file.size > maxImageSize) {
      message.error('Image file size must be less than 10MB.');
      return false;
    }

    return true;
  }

  // Валидация текстового файла
  validateTextFile(file: File): boolean {
    if (file.type !== 'text/plain') {
      message.error('Only .txt files are allowed.');
      return false;
    }

    const maxTextFileSize = 100 * 1024; // 100KB
    if (file.size > maxTextFileSize) {
      message.error('Text file size must not exceed 100KB.');
      return false;
    }

    return true;
  }

  // Ресайз изображения
  resizeImageToFit(file: File, callback: (resizedDataUrl: string) => void) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      const maxWidth = 320;
      const maxHeight = 240;
      
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const widthRatio = maxWidth / width;
        const heightRatio = maxHeight / height;
        const ratio = Math.min(widthRatio, heightRatio);
        
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const resizedDataUrl = canvas.toDataURL(file.type, 0.9);
        callback(resizedDataUrl);
      }
    };
    
    img.onerror = () => {
      message.error('Failed to process image file.');
    };
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  }

  handleImageUpload = action((file: File) => {
    if (!this.validateImageFile(file)) {
      return;
    }

    this.resizeImageToFit(file, (resizedDataUrl) => {
      runInAction(() => {
        this.selectedImageFile = file;
        this.imagePreview = resizedDataUrl;
        this.clearMessages();
      });
      message.success('Image uploaded successfully.');
    });
  });

  handleFileUpload = action((file: File) => {
    if (!this.validateTextFile(file)) {
      return;
    }

    runInAction(() => {
      this.selectedFile = file;
      this.clearMessages();
    });
    message.success('File uploaded successfully.');
  });

  handleDragDrop = action((file: File) => {
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif'];
    const isImageByExtension = fileExtension && imageExtensions.includes(fileExtension);
    const isImageByMimeType = file.type.startsWith('image/');
    
    if (isImageByExtension || isImageByMimeType) {
      if (this.selectedImageFile) {
        message.warning('Replacing existing image');
      }
      this.handleImageUpload(file);
    } else if (fileExtension === 'txt' || file.type === 'text/plain') {
      if (this.selectedFile) {
        message.warning('Replacing existing file');
      }
      this.handleFileUpload(file);
    } else {
      message.error(`Unsupported file type. Please upload an image (JPG, PNG, GIF) or text file (.txt).`);
    }
  });

  private sanitizeContent(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Проверяем длину
    if (text.length > this.MAX_TEXT_LENGTH) {
      return '';
    }

    // Заменяем все HTML теги кроме разрешенных
    const allowedTagsRegex = new RegExp(`</?(?:${this.ALLOWED_TAGS.join('|')})(?:\\s[^>]*)?>`, 'gi');
    const allTagsRegex = /<[^>]*>/g;
    
    // Находим все теги
    const allTags = text.match(allTagsRegex) || [];
    const allowedTags = text.match(allowedTagsRegex) || [];
    
    // Если есть запрещенные теги - удаляем все HTML
    if (allTags.length !== allowedTags.length) {
      return text.replace(allTagsRegex, '');
    }

    // Проверяем парность тегов (кроме <br>)
    if (!this.validateTagPairs(text)) {
      return text.replace(allTagsRegex, '');
    }

    return text;
  }

  /**
   * Проверка парности тегов
   */
  private validateTagPairs(text: string): boolean {
    const tagStack: string[] = [];
    const tagRegex = /<\/?([a-zA-Z]+)(?:\s[^>]*)?>?/g;
    
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      
      // <br> - самозакрывающийся тег
      if (tagName === 'br') {
        continue;
      }
      
      if (fullTag.startsWith('</')) {
        // Закрывающий тег
        if (tagStack.length === 0 || tagStack.pop() !== tagName) {
          return false;
        }
      } else {
        // Открывающий тег
        tagStack.push(tagName);
      }
    }
    
    return tagStack.length === 0;
  }

  /**
   * УПРОЩЕННАЯ валидация контента
   */
  private isValidContent(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return true;
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return true;
    }

    // Проверяем длину
    if (trimmedText.length > this.MAX_TEXT_LENGTH) {
      runInAction(() => {
        this.setError(`Content exceeds maximum length of ${this.MAX_TEXT_LENGTH} characters`);
      });
      return false;
    }

    // Проверяем на опасные скрипты
    const dangerousPatterns = [
      /<script\b/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi,
      /<form\b/gi
    ];

    if (dangerousPatterns.some(pattern => pattern.test(trimmedText))) {
      runInAction(() => {
        this.setError('Content contains unsafe elements');
      });
      return false;
    }

    // Санитизируем и проверяем изменения
    const sanitized = this.sanitizeContent(trimmedText);
    if (sanitized !== trimmedText) {
      runInAction(() => {
        this.setError('Content contains disallowed HTML tags. Only <b>, <i>, <u>, <br> are allowed.');
      });
      return false;
    }

    return true;
  }

 // Обновленный метод отправки
 async send(
    type: "post" | "comment",
    parentIdOrPostId?: string,
    postIdForNestedComment?: string,
    onSuccess?: () => void,
    parentSlug?: string,
    postSlug?: string
  ) {
    if (!this.text.trim() && !this.selectedImageFile && !this.selectedFile) {
      runInAction(() => {
        this.setError("Please enter some text, upload an image, or attach a file.");
      });
      return;
    }

    if (!this.isValidContent(this.text)) {
      return;
    }

    if (!this.userId || this.userId.trim() === '') {
      runInAction(() => {
        this.setError("You must be logged in to post.");
      });
      return;
    }

    const socket = socketStore[type === "post" ? "posts" : "comments"];
    if (!socket) {
      runInAction(() => {
        this.setError("Connection error. Please try again.");
      });
      return;
    }

    runInAction(() => {
      this.setLoading(true);
    });

    // Получаем ID ТОЛЬКО из slug если ID не передан
    let effectiveParentId = parentIdOrPostId;
    let effectivePostId = postIdForNestedComment;
    
    if (type === "comment" && !effectiveParentId && parentSlug) {
      const comment = commentStore.getCommentBySlug(parentSlug);
      if (comment) {
        effectiveParentId = comment.id;
      } else {
        runInAction(() => {
          this.setError("Parent comment not found");
          this.setLoading(false);
        });
        return;
      }
    }
    
    if (!effectivePostId && postSlug) {
      const post = postStore.getPostBySlug(postSlug);
      if (post) {
        effectivePostId = post.id;
      } else {
        runInAction(() => {
          this.setError("Post not found");
          this.setLoading(false);
        });
        return;
      }
    }

    const baseData: BaseData = {
      userId: this.userId,
      content: this.text,
      userName: this.userName,
      postId: null,
      parentId: null,
      image: {
        name: '',
        type: '',
        base64: ''
      }
    };

    if (type === "comment") {
      if (effectiveParentId && !effectivePostId) {
        // Ответ на комментарий
        baseData.parentId = effectiveParentId;
      } else if (effectiveParentId && effectivePostId) {
        // Вложенный комментарий
        baseData.parentId = effectiveParentId;
        baseData.postId = effectivePostId;
      } else if (effectivePostId) {
        // Комментарий к посту
        baseData.postId = effectivePostId;
      }
    }

    const emitData = () => {
      socket.emit(
        type === "post" ? "addPost" : "addComment",
        baseData,
        (ack: { success: boolean; message?: string }) => {
          runInAction(() => {
            this.setLoading(false);
            if (ack.success) {
              this.setSuccess("Your content has been posted successfully");
              onSuccess?.();
              this.resetForm();
            } else if (ack.message) {
              this.setError(ack.message);
            }
          });
        }
      );
    };

    try {
      // Логика отправки файлов (без изменений)
      if (this.selectedImageFile && this.selectedFile) {
        // И изображение, и файл
        const imageBase64 = this.imagePreview!.split(",")[1];
        const file = this.selectedFile;
        
        const reader = new FileReader();
        reader.onload = () => {
          const fileBase64 = (reader.result as string).split(",")[1];
          
          baseData.image = {
            name: this.selectedImageFile!.name,
            type: this.selectedImageFile!.type,
            base64: imageBase64
          };
          
          baseData.file = {
            name: file.name,
            type: file.type,
            base64: fileBase64
          };
          
          emitData();
        };
        reader.readAsDataURL(file);
      }
      else if (this.selectedImageFile && this.imagePreview) {
        // Только изображение
        const base64 = this.imagePreview.split(",")[1];
        
        baseData.image = {
          name: this.selectedImageFile.name,
          type: this.selectedImageFile.type,
          base64: base64
        };
        
        emitData();
      }
      else if (this.selectedFile) {
        // Только файл
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          
          baseData.file = {
            name: this.selectedFile!.name,
            type: this.selectedFile!.type,
            base64: base64
          };
          
          emitData();
        };
        reader.readAsDataURL(this.selectedFile);
      }
      else {
        // Только текст
        emitData();
      }
    } catch (error) {
      runInAction(() => {
        this.setLoading(false);
        this.setError("An error occurred while posting");
      });
      logger.error("Send error:", error);
    }
  }
}

export const sendFormStore = new SendFormStore();