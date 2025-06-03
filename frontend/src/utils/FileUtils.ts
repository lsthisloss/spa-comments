import { message } from 'antd';

/**
 * Утилиты для работы с файлами и изображениями
 */
export class FileUtils {
  /**
   * Проверяет, является ли файл изображением допустимого формата и размера
   */
  static validateImageFile(file: File): boolean {
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

  /**
   * Проверяет, является ли файл текстовым документом допустимого формата и размера
   */
  static validateTextFile(file: File): boolean {
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

  /**
   * Определяет тип файла по расширению и MIME-типу
   */
  static getFileType(file: File): 'image' | 'text' | 'unsupported' {
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif'];
    const isImageByExtension = fileExtension && imageExtensions.includes(fileExtension);
    const isImageByMimeType = file.type.startsWith('image/');
    
    if (isImageByExtension || isImageByMimeType) {
      return 'image';
    } else if (fileExtension === 'txt' || file.type === 'text/plain') {
      return 'text';
    } else {
      return 'unsupported';
    }
  }

  /**
   * Изменяет размер изображения для подгонки под ограничения
   */
  static resizeImageToFit(file: File, callback: (resizedDataUrl: string) => void): void {
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

  /**
   * Преобразует файл в формат base64
   */
  static readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}