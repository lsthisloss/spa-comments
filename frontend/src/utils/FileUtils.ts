import { message } from 'antd';

/**
 * Утилиты для работы с файлами и изображениями
 */
export class FileUtils {
  // Константы для изображений
  static readonly MAX_IMAGE_WIDTH = 320;
  static readonly MAX_IMAGE_HEIGHT = 240;
  static readonly MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB после сжатия
  static readonly JPEG_QUALITY = 0.8;

  // Константы для текстовых файлов
  static readonly MAX_TEXT_FILE_SIZE = 100 * 1024; // 100KB

  static validateImageFile(file: File): boolean {
    if (!file.type.startsWith('image/')) {
      message.error('Please select an image file.');
      return false;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      message.error('Only JPG, PNG, and GIF images are allowed.');
      return false;
    }

    // Проверяем исходный размер файла (до ресайза)
    if (file.size > 10 * 1024 * 1024) { // 10MB
      message.error('Image file is too large. Maximum size is 10MB.');
      return false;
    }

    return true;
  }

  static validateTextFile(file: File): boolean {
    if (file.type !== 'text/plain') {
      message.error('Only TXT files are allowed.');
      return false;
    }

    if (file.size > this.MAX_TEXT_FILE_SIZE) {
      message.error(`Text file is too large. Maximum size is ${this.MAX_TEXT_FILE_SIZE / 1024}KB.`);
      return false;
    }

    return true;
  }

  static resizeImageToFit(file: File, callback: (dataUrl: string) => void): void {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          message.error('Canvas not supported');
          return;
        }

        // Вычисляем новые размеры с сохранением пропорций
        const { width: newWidth, height: newHeight } = this.calculateResizeDimensions(
          img.width, 
          img.height, 
          this.MAX_IMAGE_WIDTH, 
          this.MAX_IMAGE_HEIGHT
        );

        canvas.width = newWidth;
        canvas.height = newHeight;

        // Рисуем изображение с новыми размерами
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Определяем качество и формат в зависимости от исходного типа
        let outputFormat = file.type;
        let quality: number | undefined = this.JPEG_QUALITY;

        // Для GIF конвертируем в PNG для лучшего качества при ресайзе
        if (file.type === 'image/gif') {
          outputFormat = 'image/png';
          quality = undefined; // PNG не использует качество
        }

        // Конвертируем в нужный формат
        const dataUrl = quality !== undefined 
          ? canvas.toDataURL(outputFormat, quality)
          : canvas.toDataURL(outputFormat);

        // Проверяем финальный размер
        const base64Data = dataUrl.split(',')[1];
        const sizeInBytes = (base64Data.length * 3) / 4; // Приблизительный размер

        if (sizeInBytes > this.MAX_IMAGE_SIZE_BYTES) {
          // Если все еще слишком большой, уменьшаем качество
          const reducedQuality = Math.max(0.3, (quality || this.JPEG_QUALITY) * 0.7);
          const reducedDataUrl = canvas.toDataURL('image/jpeg', reducedQuality);
          callback(reducedDataUrl);
        } else {
          callback(dataUrl);
        }

        console.log(`[FileUtils] Image resized: ${img.width}x${img.height} → ${newWidth}x${newHeight}, quality: ${quality}`);
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.readAsDataURL(file);
  }

  private static calculateResizeDimensions(
    originalWidth: number, 
    originalHeight: number, 
    maxWidth: number, 
    maxHeight: number
  ): { width: number; height: number } {
    // Если изображение уже меньше максимальных размеров, не изменяем
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    // Вычисляем соотношение сторон
    const aspectRatio = originalWidth / originalHeight;
    
    let newWidth = maxWidth;
    let newHeight = maxWidth / aspectRatio;
    
    // Если высота превышает максимальную, корректируем по высоте
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = maxHeight * aspectRatio;
    }
    
    return { 
      width: Math.round(newWidth), 
      height: Math.round(newHeight) 
    };
  }

  static getFileType(file: File): 'image' | 'text' | 'unknown' {
    if (file.type.startsWith('image/')) {
      return 'image';
    }
    
    if (file.type === 'text/plain') {
      return 'text';
    }
    
    return 'unknown';
  }

  static async readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}