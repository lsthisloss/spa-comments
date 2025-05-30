import { Injectable } from '@nestjs/common';
import * as svgCaptcha from 'svg-captcha';
import * as path from 'path';
import * as fs from 'fs';
import { Socket } from 'socket.io';

interface FileUploadData {
  file: {
    name: string;
    type: string;
    base64: string;
  };
}

interface FileUploadResult {
  fileUrl: string;
  fileName: string;
  fileType: string;
  isImage: boolean;
}

@Injectable()
export class CommonWsService {
  private captchas = new Map<string, string>();

  generateCaptcha(client: Socket) {
    const captcha = svgCaptcha.create({
      size: 6,
      noise: 3,
      color: true,
      background: '#f4f4f4',
    });
    this.captchas.set(client.id, captcha.text);
    return { image: captcha.data };
  }

  validateCaptcha(client: Socket, data: { captcha: string }) {
    const storedCaptcha = this.captchas.get(client.id);
    if (storedCaptcha && storedCaptcha === data.captcha) {
      this.captchas.delete(client.id);
      return { valid: true };
    }
    return { valid: false };
  }

  uploadFile(data: { file: string; fileName: string }) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fileName = `${Date.now()}-${data.fileName}`;
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(data.file, 'base64');
    fs.writeFileSync(filePath, buffer);
    const fileUrl = `/uploads/${fileName}`;
    return { fileUrl };
  }

  /**
   * Process file upload from request data and save to disk
   * @param fileData - Object containing file information
   * @returns Processed file information or null if no file
   */
  processFileUpload(fileData: FileUploadData): FileUploadResult | null {
    if (!fileData?.file?.base64 || !fileData?.file?.name) {
      return null;
    }

    const { file } = fileData;
    const buffer = Buffer.from(file.base64, 'base64');
    const isImage = file.type.startsWith('image/');

    if (isImage) {
      // Image validation
      const maxImageSize = 10 * 1024 * 1024; // 10MB
      if (buffer.length > maxImageSize) {
        throw new Error('Image file size exceeds 10MB limit');
      }

      if (
        !['image/jpeg', 'image/png', 'image/jpg', 'image/gif'].includes(
          file.type,
        )
      ) {
        throw new Error(
          'Invalid image format. Only JPG, PNG, and GIF are allowed.',
        );
      }
    } else {
      // Text file validation
      const maxTextSize = 100 * 1024; // 100KB
      if (buffer.length > maxTextSize) {
        throw new Error('Text file size exceeds 100KB limit');
      }

      if (file.type !== 'text/plain') {
        throw new Error('Only .txt files are allowed for non-image uploads.');
      }
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${sanitizedName}`;
    const filePath = path.join(uploadDir, fileName);

    // Save file to disk
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${fileName}`;

    console.log(
      `File uploaded successfully: ${fileName} (${buffer.length} bytes)`,
    );

    return {
      fileUrl,
      fileName: file.name,
      fileType: file.type,
      isImage,
    };
  }
  processContentWithMultipleFiles(
    content: string,
    files: {
      file?: {
        name: string;
        type: string;
        base64: string;
      };
      image?: {
        name: string;
        type: string;
        base64: string;
      };
    },
  ) {
    const result: {
      content: string;
      fileUrl: string | null;
      fileName: string | null;
      fileType: string | null;
      imageUrl: string | null;
    } = {
      content,
      fileUrl: null,
      fileName: null,
      fileType: null,
      imageUrl: null,
    };

    // Обработка изображения
    if (files.image) {
      const imageResult = this.processFileUpload({ file: files.image });
      if (imageResult) {
        result.imageUrl = imageResult.fileUrl;

        // Если другого файла нет, используем данные изображения также для file полей
        if (!files.file) {
          result.fileUrl = imageResult.fileUrl;
          result.fileName = imageResult.fileName;
          result.fileType = imageResult.fileType;
        }
      }
    }

    // Обработка файла (не изображения)
    if (files.file) {
      const fileResult = this.processFileUpload({ file: files.file });
      if (fileResult) {
        result.fileUrl = fileResult.fileUrl;
        result.fileName = fileResult.fileName;
        result.fileType = fileResult.fileType;

        // Если файл - это изображение и imageUrl еще нет, установим его
        if (!result.imageUrl && this.isImageMimeType(files.file.type)) {
          result.imageUrl = fileResult.fileUrl;
        }
      }
    }

    return result;
  }

  // Вспомогательный метод для проверки MIME-типа изображений
  private isImageMimeType(mimeType: string): boolean {
    return /^image\//.test(mimeType);
  }

  /**
   * Process content with file upload and return complete data
   * @returns Object with content and file information
   */
  processContentWithFile(content: string, fileData?: FileUploadData) {
    const result: {
      content: string;
      fileUrl: string | null;
      fileName: string | null;
      fileType: string | null;
      imageUrl: string | null;
    } = {
      content,
      fileUrl: null,
      fileName: null,
      fileType: null,
      imageUrl: null,
    };

    if (fileData) {
      try {
        const uploadResult: FileUploadResult | null =
          this.processFileUpload(fileData);
        if (uploadResult) {
          result.fileUrl = uploadResult.fileUrl;
          result.fileName = uploadResult.fileName;
          result.fileType = uploadResult.fileType;

          // For backward compatibility, set imageUrl for images
          if (uploadResult.isImage) {
            result.imageUrl = uploadResult.fileUrl;
          }
        }
      } catch (error) {
        console.error('File upload error:', error);
        throw error;
      }
    }

    return result;
  }

  /**
   * Process avatar upload from WebSocket request
   * @returns Processed avatar information
   */
  processAvatarUpload(
    fileData: FileUploadData,
    userId: string,
    avatarShape: 'circle' | 'square' = 'circle',
  ): { avatarUrl: string; avatarShape: string } {
    if (!fileData?.file?.base64 || !fileData?.file?.name) {
      throw new Error('Invalid avatar data');
    }

    const { file } = fileData;
    const buffer = Buffer.from(file.base64, 'base64');

    // Validate image type
    if (!file.type.startsWith('image/')) {
      throw new Error('Avatar must be an image file');
    }

    // Image validation
    const maxAvatarSize = 2 * 1024 * 1024; // 2MB
    if (buffer.length > maxAvatarSize) {
      throw new Error('Avatar file size exceeds 2MB limit');
    }

    if (
      !['image/jpeg', 'image/png', 'image/jpg', 'image/gif'].includes(file.type)
    ) {
      throw new Error(
        'Invalid image format. Only JPG, PNG, and GIF are allowed.',
      );
    }

    // Create avatar directory
    const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }

    // Generate unique filename with user ID
    const timestamp = Date.now();
    const extension = this.getFileExtension(file.name);
    const fileName = `avatar_${userId}_${timestamp}${extension}`;
    const filePath = path.join(avatarDir, fileName);

    // Save file to disk
    fs.writeFileSync(filePath, buffer);

    const avatarUrl = `/uploads/avatars/${fileName}`;

    console.log(
      `Avatar uploaded for user ${userId}: ${fileName} (${buffer.length} bytes)`,
    );

    return {
      avatarUrl,
      avatarShape,
    };
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return ext;
  }
}
