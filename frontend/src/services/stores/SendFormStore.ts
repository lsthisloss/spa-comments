import { makeObservable, observable, action, runInAction } from 'mobx';
import { message } from 'antd';
import { socketStore } from './SocketStore';
import { logger } from "../../utils/Logger";
import { SendData } from '../../types/interfaces';
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

  initializeUser = action((userId: string, userName: string, avatarUrl?: string, avatarShape?: 'circle' | 'square') => {
    // Проверяем, нужно ли обновлять данные
    const needsUpdate = 
      this.userId !== userId ||
      this.userName !== userName ||
      this.avatarUrl !== (avatarUrl || null) ||
      this.avatarShape !== (avatarShape || 'circle');
    
    if (!needsUpdate) {
      return; // Не обновляем, если данные не изменились
    }
    
    console.log('[SendFormStore] Initializing user:', { userId, userName, avatarUrl, avatarShape });
    
    this.userId = userId;
    this.userName = userName;
    this.avatarUrl = avatarUrl || null;
    this.avatarShape = avatarShape || 'circle';
    
    console.log('[SendFormStore] User initialized with:', {
      userId: this.userId,
      userName: this.userName,
      avatarUrl: this.avatarUrl,
      avatarShape: this.avatarShape
    });
  });

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

  private sanitizeContent(text: string): { valid: boolean; sanitized: string; error?: string } {
    // Base checks
    if (!text || typeof text !== 'string') {
      return { valid: true, sanitized: '' };
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return { valid: true, sanitized: '' };
    }

    // Length check
    if (trimmedText.length > this.MAX_TEXT_LENGTH) {
      return { 
        valid: false, 
        sanitized: '', 
        error: `Content exceeds maximum length of ${this.MAX_TEXT_LENGTH} characters` 
      };
    }

    // Security check for dangerous patterns
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
      return { 
        valid: false, 
        sanitized: '', 
        error: 'Content contains unsafe elements' 
      };
    }

    // Process HTML tags
    const allowedTagsRegex = new RegExp(`</?(?:${this.ALLOWED_TAGS.join('|')})(?:\\s[^>]*)?>`, 'gi');
    const allTagsRegex = /<[^>]*>/g;
    
    // Find all tags
    const allTags = trimmedText.match(allTagsRegex) || [];
    const allowedTags = trimmedText.match(allowedTagsRegex) || [];
    
    // If there are disallowed tags - sanitize by removing all HTML
    if (allTags.length !== allowedTags.length) {
      return { 
        valid: false, 
        sanitized: trimmedText.replace(allTagsRegex, ''), 
        error: 'Content contains disallowed HTML tags. Only <b>, <i>, <u>, <br> are allowed.'
      };
    }

    // Check tag pairs (except <br>)
    const tagStack: string[] = [];
    const tagRegex = /<\/?([a-zA-Z]+)(?:\s[^>]*)?>?/g;
    let match;
    let invalidPairs = false;
    
    while ((match = tagRegex.exec(trimmedText)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      
      // <br> is self-closing
      if (tagName === 'br') continue;
      
      if (fullTag.startsWith('</')) {
        // Closing tag
        if (tagStack.length === 0 || tagStack.pop() !== tagName) {
          invalidPairs = true;
          break;
        }
      } else {
        // Opening tag
        tagStack.push(tagName);
      }
    }
    
    if (invalidPairs || tagStack.length > 0) {
      return { 
        valid: false, 
        sanitized: trimmedText.replace(allTagsRegex, ''), 
        error: 'HTML tags are not properly paired'
      };
    }

    return { valid: true, sanitized: trimmedText };
  }

  /**
   * Helper to resolve IDs from slugs
   */
  private resolveIds(
    type: "post" | "comment", 
    parentIdOrPostId?: string, 
    postIdForNestedComment?: string, 
    parentSlug?: string, 
    postSlug?: string
  ): { parentId?: string; postId?: string; error?: string } {
    let effectiveParentId = parentIdOrPostId;
    let effectivePostId = postIdForNestedComment;
    
    // Resolve parent comment from slug if needed
    if (type === "comment" && !effectiveParentId && parentSlug) {
      const comment = commentStore.getCommentBySlug(parentSlug);
      if (comment) {
        effectiveParentId = comment.id;
        
        // If comment has postId, use it
        if (!effectivePostId && comment.postId) {
          logger.log(`[SendFormStore] Using postId from parent comment: ${comment.postId}`);
          effectivePostId = comment.postId;
        }
      } else {
        return { error: "Parent comment not found" };
      }
    }
    
    // Resolve post from slug if needed
    if (!effectivePostId && postSlug) {
      // Check if postSlug is actually a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postSlug);
      
      if (isUUID) {
        // If UUID, use directly as ID
        logger.log(`[SendFormStore] Using postSlug as postId directly: ${postSlug}`);
        effectivePostId = postSlug;
      } else {
        // If slug, lookup post in store
        const post = postStore.getPostBySlug(postSlug);
        if (post) {
          effectivePostId = post.id;
          logger.log(`[SendFormStore] Resolved postSlug ${postSlug} to ID ${effectivePostId}`);
        } else {
          logger.error(`[SendFormStore] Post not found for slug: ${postSlug}`);
          return { error: "Post not found" };
        }
      }
    }
    
    // Validation: comments must have a post ID
    if (type === "comment" && !effectivePostId) {
      logger.error("[SendFormStore] Failed to determine postId for comment");
      return { error: "Cannot determine post ID for this comment" };
    }
    
    return { parentId: effectiveParentId, postId: effectivePostId };
  }

  // Simplified send method
async send(
  type: "post" | "comment",
  parentIdOrPostId?: string,
  postIdForNestedComment?: string,
  onSuccess?: () => void,
  parentSlug?: string,
  postSlug?: string
) {
  logger.log(`[SendFormStore] send called with: type=${type}, parentSlug=${parentSlug}, postSlug=${postSlug}`);

  if (!this.text.trim() && !this.selectedImageFile && !this.selectedFile) {
    runInAction(() => {
      this.setError("Please enter some text, upload an image, or attach a file.");
    });
    return;
  }

  // Validate content using unified function
  const { valid, sanitized, error } = this.sanitizeContent(this.text);
  if (!valid) {
    runInAction(() => {
      this.setError(error || "Invalid content");
    });
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

  // Resolve IDs from slugs
  const resolved = this.resolveIds(type, parentIdOrPostId, postIdForNestedComment, parentSlug, postSlug);
  
  if (resolved.error) {
    runInAction(() => {
        this.setError(resolved.error || "An error occurred");
        this.setLoading(false);
      });
    return;
  }

  // Form base data with resolved IDs
  const baseData: SendData = {
    userId: this.userId,
    content: sanitized,
    userName: this.userName,
    postId: resolved.postId,
    parentId: resolved.parentId,
    image: {
      name: '',
      type: '',
      base64: ''
    }
  };

  // Логируем полученные данные перед отправкой
  logger.log(`[SendFormStore] Sending ${type} with data:`, {
    parentId: baseData.parentId,
    postId: baseData.postId
  });

  if (type === "comment") {
    if (resolved.parentId && !resolved.postId) {
      // Ответ на комментарий
      baseData.parentId = resolved.parentId;
    } else if (resolved.parentId && resolved.postId) {
      // Вложенный комментарий
      baseData.parentId = resolved.parentId;
      baseData.postId = resolved.postId;
    } else if (resolved.postId) {
      // Комментарий к посту
      baseData.postId = resolved.postId;
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