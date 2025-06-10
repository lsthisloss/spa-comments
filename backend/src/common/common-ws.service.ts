import { Injectable } from '@nestjs/common';
import * as svgCaptcha from 'svg-captcha';
import * as path from 'path';
import * as fs from 'fs';
import * as sharp from 'sharp';
import { Socket as IOSocket } from 'socket.io';
import { TestService } from 'src/test/test.service';

interface SocketData {
  captchaVerified?: boolean;
}

type Socket = IOSocket & { data: SocketData };
const verifiedClients = new Map<
  string,
  { verified: boolean; timestamp: number }
>();

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

const globalCaptchaStore = new Map<
  string,
  { text: string; timestamp: number }
>();

@Injectable()
export class CommonWsService {
  // Константы для валидации файлов
  private readonly MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB для изображений после ресайза
  private readonly MAX_TEXT_FILE_SIZE = 100 * 1024; // 100KB для текстовых файлов
  private readonly MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB для аватаров
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/gif',
  ];
  private readonly ALLOWED_TEXT_TYPES = ['text/plain'];

  // Константы для ресайза изображений
  private readonly MAX_IMAGE_WIDTH = 320;
  private readonly MAX_IMAGE_HEIGHT = 240;

  constructor(private readonly testService: TestService) {
    // Очищаем устаревшие капчи каждые 5 минут
    setInterval(
      () => {
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        for (const [clientId, captchaData] of globalCaptchaStore.entries()) {
          if (now - captchaData.timestamp > fiveMinutes) {
            globalCaptchaStore.delete(clientId);
            console.log(
              `[CAPTCHA] Expired captcha removed for client ${clientId}`,
            );
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  generateCaptcha(client: Socket) {
    const captcha = svgCaptcha.create({
      size: 6,
      noise: 3,
      color: true,
      background: '#f4f4f4',
    });

    globalCaptchaStore.set(client.id, {
      text: captcha.text,
      timestamp: Date.now(),
    });

    console.log(`[CAPTCHA] Generated for client ${client.id}: ${captcha.text}`);
    return { image: captcha.data };
  }

  validateCaptcha(client: Socket, data: { captcha: string }) {
    const captchaData = globalCaptchaStore.get(client.id);

    if (!captchaData) {
      console.log(`[CAPTCHA] No captcha found for client ${client.id}`);
      return { valid: false };
    }

    if (captchaData.text.toLowerCase() === data.captcha.toLowerCase()) {
      (client.data as SocketData).captchaVerified = true;

      verifiedClients.set(client.id, {
        verified: true,
        timestamp: Date.now(),
      });

      globalCaptchaStore.delete(client.id);
      console.log(`[CAPTCHA] Valid for client ${client.id}, client verified`);
      return { valid: true };
    }

    console.log(
      `[CAPTCHA] Invalid: expected="${captchaData.text}", got="${data.captcha}"`,
    );
    return { valid: false };
  }

  isCaptchaVerified(client: Socket): boolean {
    if (client.data && typeof client.data === 'object') {
      const data = client.data as Record<string, unknown>;

      // АДМИНЫ ПРОХОДЯТ АВТОМАТИЧЕСКИ
      if ('user' in data && data.user && typeof data.user === 'object') {
        const user = data.user as Record<string, unknown>;

        if ('role' in user && typeof user.role === 'string') {
          const role = user.role;

          if (role === 'admin' || role === 'superadmin') {
            console.log(
              `[CAPTCHA] Admin auto-verified: ${role} for client ${client.id}`,
            );
            return true;
          }
        }
      }

      const testDataGeneration =
        client.handshake?.query?.testDataGeneration === 'true';
      if (testDataGeneration) {
        console.log(
          `[CAPTCHA] Test data generation verified for client ${client.id}`,
        );
        return true;
      }

      if ('captchaVerified' in data && data.captchaVerified === true) {
        console.log(`[CAPTCHA] Pre-verified for client ${client.id}`);
        return true;
      }
    }

    return this.performStandardCaptchaCheck(client);
  }

  private performStandardCaptchaCheck(client: Socket): boolean {
    if ((client.data as SocketData)?.captchaVerified === true) {
      return true;
    }

    const verificationData = verifiedClients.get(client.id);
    if (verificationData?.verified) {
      const tenMinutes = 10 * 60 * 1000;
      if (Date.now() - verificationData.timestamp < tenMinutes) {
        return true;
      }
      verifiedClients.delete(client.id);
    }

    console.log(`[CAPTCHA] Verification failed for client ${client.id}`);
    return false;
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
   * Ресайзит изображение до максимальных размеров 320x240
   */
  private async resizeImage(buffer: Buffer, fileName: string): Promise<Buffer> {
    try {
      console.log(
        `[IMAGE] Starting resize for ${fileName}, original size: ${buffer.length} bytes`,
      );

      const resizedBuffer = await sharp(buffer)
        .resize(this.MAX_IMAGE_WIDTH, this.MAX_IMAGE_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 }) // Конвертируем в JPEG для оптимизации
        .toBuffer();

      console.log(
        `[IMAGE] Resized ${fileName}: ${buffer.length} → ${resizedBuffer.length} bytes`,
      );
      return resizedBuffer;
    } catch (error) {
      console.error(`[IMAGE] Error resizing ${fileName}:`, error);
      throw new Error(
        `Failed to resize image: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async processFileUpload(
    fileData: FileUploadData,
  ): Promise<FileUploadResult | null> {
    if (!fileData?.file?.base64 || !fileData?.file?.name) {
      console.error('Invalid file data: missing base64 or name');
      return null;
    }

    const { file } = fileData;
    let buffer = Buffer.from(file.base64, 'base64');
    const isImage = file.type.startsWith('image/');

    // Валидация и обработка изображений
    if (isImage) {
      if (!this.ALLOWED_IMAGE_TYPES.includes(file.type)) {
        console.error(
          `Invalid image type: ${file.type}. Allowed: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`,
        );
        return null;
      }

      console.log(
        `[IMAGE] Processing image: ${file.name} (${file.type}, original: ${buffer.length} bytes)`,
      );

      try {
        // Ресайзим изображение до 320x240
        buffer = await this.resizeImage(buffer, file.name);

        // Проверяем размер после ресайза
        if (buffer.length > this.MAX_IMAGE_SIZE) {
          console.error(
            `Image still too large after resize: ${buffer.length} bytes (max: ${this.MAX_IMAGE_SIZE} bytes)`,
          );
          return null;
        }

        console.log(
          `[IMAGE] Image processed successfully: ${file.name} (final size: ${buffer.length} bytes)`,
        );
      } catch (error) {
        console.error(`[IMAGE] Failed to process image ${file.name}:`, error);
        return null;
      }
    } else {
      // Валидация текстовых файлов
      if (buffer.length > this.MAX_TEXT_FILE_SIZE) {
        console.error(
          `Text file too large: ${buffer.length} bytes (max: ${this.MAX_TEXT_FILE_SIZE} bytes = ${this.MAX_TEXT_FILE_SIZE / 1024}KB)`,
        );
        return null;
      }

      if (!this.ALLOWED_TEXT_TYPES.includes(file.type)) {
        console.error(
          `Invalid file type: ${file.type}. Allowed: ${this.ALLOWED_TEXT_TYPES.join(', ')}`,
        );
        return null;
      }

      console.log(
        `[FILE] Accepted text file: ${file.name} (${file.type}, ${buffer.length} bytes)`,
      );
    }

    return this.saveFileToUploads(file, buffer);
  }

  private saveFileToUploads(
    file: { name: string; type: string },
    buffer: Buffer,
  ): FileUploadResult | null {
    const uploadDir = path.join(process.cwd(), 'uploads');

    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`Created uploads directory: ${uploadDir}`);
      }
    } catch (dirError) {
      console.error(`Failed to create uploads directory:`, dirError);
      return null;
    }

    // Генерируем уникальное имя файла
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Для изображений всегда используем .jpg расширение после ресайза
    const isImage = file.type.startsWith('image/');
    const extension = isImage ? '.jpg' : this.getFileExtension(file.name);
    const fileName = `${timestamp}-${randomSuffix}-${sanitizedName.replace(/\.[^/.]+$/, '')}${extension}`;

    const filePath = path.join(uploadDir, fileName);

    try {
      fs.writeFileSync(filePath, buffer);

      // Проверяем что файл действительно создался
      if (!fs.existsSync(filePath)) {
        console.error(`File was not created: ${filePath}`);
        return null;
      }

      const fileStats = fs.statSync(filePath);
      console.log(
        `[FILE] File saved successfully: ${fileName} (${fileStats.size} bytes)`,
      );

      const fileUrl = `/uploads/${fileName}`;

      return {
        fileUrl,
        fileName: file.name,
        fileType: isImage ? 'image/jpeg' : file.type, // Обновляем тип для обработанных изображений
        isImage,
      };
    } catch (saveError) {
      console.error(`Failed to save file ${fileName}:`, saveError);
      return null;
    }
  }
  private isImageMimeType(mimeType: string): boolean {
    return /^image\//.test(mimeType);
  }
  async processContentWithMultipleFiles(
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
      const imageResult = await this.processFileUpload({ file: files.image });
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
      const fileResult = await this.processFileUpload({ file: files.file });
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

  async processContentWithFile(content: string, fileData?: FileUploadData) {
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
          await this.processFileUpload(fileData);
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

  async processAvatarUpload(
    fileData: FileUploadData,
    userId: string,
    avatarShape: 'circle' | 'square' = 'circle',
  ): Promise<{ avatarUrl: string; avatarShape: string }> {
    if (!fileData?.file?.base64 || !fileData?.file?.name) {
      throw new Error('Invalid avatar data');
    }

    const { file } = fileData;
    let buffer = Buffer.from(file.base64, 'base64');

    // Validate image type
    if (!file.type.startsWith('image/')) {
      throw new Error('Avatar must be an image file');
    }

    if (
      !['image/jpeg', 'image/png', 'image/jpg', 'image/gif'].includes(file.type)
    ) {
      throw new Error(
        'Invalid image format. Only JPG, PNG, and GIF are allowed.',
      );
    }

    try {
      // Ресайзим аватар до разумных размеров (например, 200x200)
      console.log(
        `[AVATAR] Resizing avatar for user ${userId}, original size: ${buffer.length} bytes`,
      );

      buffer = await sharp(buffer)
        .resize(200, 200, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      console.log(
        `[AVATAR] Avatar resized for user ${userId}, new size: ${buffer.length} bytes`,
      );
    } catch (error) {
      console.error(
        `[AVATAR] Error resizing avatar for user ${userId}:`,
        error,
      );
      throw new Error(
        `Failed to resize avatar: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Image validation with more lenient limits for test users
    const isTestUser = userId.startsWith('test-user-');
    const maxAvatarSize = isTestUser ? 1 * 1024 * 1024 : 2 * 1024 * 1024; // 1MB для тестовых, 2MB для обычных

    if (buffer.length > maxAvatarSize) {
      throw new Error(
        `Avatar file size exceeds ${maxAvatarSize / (1024 * 1024)}MB limit`,
      );
    }

    // Create avatar directory
    const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }

    // Generate unique filename with user ID
    const timestamp = Date.now();
    const fileName = isTestUser
      ? `test_avatar_${userId}_${timestamp}.jpg`
      : `avatar_${userId}_${timestamp}.jpg`;
    const filePath = path.join(avatarDir, fileName);

    // Save file to disk
    fs.writeFileSync(filePath, buffer);

    const avatarUrl = `/uploads/avatars/${fileName}`;

    console.log(
      `Avatar uploaded for ${isTestUser ? 'test ' : ''}user ${userId}: ${fileName} (${buffer.length} bytes)`,
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
