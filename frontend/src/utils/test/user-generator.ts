import io from 'socket.io-client';
import { randomUserName } from './generators';
import { TestConfig } from './config';
import { testService } from '../../services/test/TestService';
import { getRandomText } from './content/content-data';
import { getImageThemeByIndex, ImageTheme } from './content/image-themes';


export interface UserCreationResult {
  success: boolean;
  user?: {
    id: string;
    userName: string;
    token: string;
  };
  error?: string;
}

interface PostMedia {
  name: string;
  type: string;
  base64: string;
}

interface PostData {
  content: string;
  userId: string;
  userName: string;
  image?: PostMedia;
  file?: PostMedia;
}

export interface PostCreationStats {
  created: number;
  queued: number;
  rateLimited: number;
  errors: number;
}


export class TestUserGenerator {
  private config: TestConfig;
  private saveToDatabase: boolean;
  private generateWithMedia: boolean;

  constructor(config: TestConfig, saveToDatabase: boolean = true, generateWithMedia: boolean = true) {
    this.config = config;
    this.saveToDatabase = saveToDatabase;
    this.generateWithMedia = generateWithMedia;
    
    if (saveToDatabase) {
      console.log(`💾 Real mode: data will be saved to database`);
    } else {
      console.log(`⚡ Test mode: using mock data, no database saves`);
      testService.setTestEnvironment(config);
    }
    
    console.log(`📷 Media generation: ${generateWithMedia ? 'ENABLED' : 'DISABLED'}`);
  }

async createUser(userIndex: number, prefix = 'testuser'): Promise<UserCreationResult> {
  const userName = randomUserName();
  const userData = {
    email: `${prefix}_${Date.now()}_${userIndex}@sk8.pw`,
    userName,
    password: 'asdyt1Aq4edf*',
    testDataGeneration: true  // Добавляем флаг прямо в данные пользователя
  };

  console.log(`🧑 Creating user ${userIndex}: ${userData.userName} ${this.saveToDatabase ? '(REAL MODE)' : '(TEST MODE)'}`);

  return new Promise((resolve, reject) => {
    const userSocket = this.createSocket('/users');

    if (!userSocket) {
      reject(new Error('Failed to create socket'));
      return;
    }

    const operationTimeout = setTimeout(() => {
      console.error(`⏰ Operation timeout for user ${userData.userName}`);
      userSocket.disconnect();
      reject(new Error('Operation timeout'));
    }, this.config.timeouts.operation);

    userSocket.on('connect', () => {
      console.log(`✅ Connected to /users for ${userData.userName} (testDataGeneration: true)`);

      userSocket.emit('register', userData, async (registerResponse: {
        token?: string;
        user?: { id?: string };
        message?: string;
        success?: boolean;
      }) => {
        try {
          if (registerResponse.success && registerResponse.token && registerResponse.user?.id) {
            console.log(`📝 User ${userData.userName} registered successfully with ID: ${registerResponse.user.id}`);
            userSocket.disconnect();
            clearTimeout(operationTimeout);

            resolve({
              success: true,
              user: {
                id: registerResponse.user.id,
                userName: userData.userName,
                token: registerResponse.token,
              },
            });
          } else {
            console.error(`❌ Registration failed for ${userData.userName}:`, registerResponse.message);
            userSocket.disconnect();
            clearTimeout(operationTimeout);
            resolve({
              success: false,
              error: registerResponse.message || 'Registration failed',
            });
          }
        } catch (error) {
          console.error(`❌ Error processing registration for ${userData.userName}:`, error);
          userSocket.disconnect();
          clearTimeout(operationTimeout);
          reject(error);
        }
      });
    });

    userSocket.on('connect_error', (error: Error) => {
      console.error(`❌ Users socket connection error for ${userData.userName}:`, error.message);
      clearTimeout(operationTimeout);
      reject(error);
    });

    userSocket.on('disconnect', (reason: unknown) => {
      console.log(`🔌 User socket disconnected for ${userData.userName}:`, reason);
    });
  });
}
private createSocket(namespace: string, token?: string) {
  try {
    const socketConfig: {
      transports: string[];
      reconnectionAttempts: number;
      reconnectionDelay: number;
      timeout: number;
      query: Record<string, string>;
      auth: Record<string, string | boolean>;
    } = {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      // Добавляем testDataGeneration и в query, и в auth для надёжности
      query: {
        testDataGeneration: 'true'
      },
      auth: {
        testDataGeneration: 'true'
      }
    };
    
    // Добавляем токен если есть, сохраняя testDataGeneration
    if (token) {
      socketConfig.auth = { 
        ...socketConfig.auth,
        token 
      };
    }
    
    // Добавляем параметр прямо в URL для гарантии
    const url = `${this.config.socketURL}${namespace}?testDataGeneration=true`;
    console.log(`[Test] Creating socket connection to ${url}`);
    
    const socket = io(url, socketConfig);
    
    socket.on('connect', () => {
      console.log(`[Test] Socket connected to ${namespace} (testDataGeneration: true)`);
      
      // Для надёжности отправим событие сразу после подключения
      socket.emit('setTestMode', { testDataGeneration: true });
    });
    
    socket.on('connect_error', (error: unknown) => {
      console.error(`[Test] Socket connection error for ${namespace}:`, error);
    });
    
    return socket;
  } catch (error) {
    console.error(`[Test] Error creating socket for ${namespace}:`, error);
    return null;
  }
}
  /**
   * Генерация простого поста без сложных медиа-файлов
   */
   private generateSimplePost(postIndex: number, userId: string, userName: string): PostData {
    // Используем новый тематический контент
    const content = getRandomText(postIndex);

    const postData: PostData = {
      content,
      userId,
      userName,
    };

    // ИСПРАВЛЕНО: проверяем флаг generateWithMedia
    if (this.generateWithMedia) {
      // Добавляем тематическое изображение в 40% случаев  
      if (Math.random() < 0.4) {
        const thematicImage = this.generateThematicImage(postIndex);
        postData.image = {
          name: thematicImage.name,
          type: thematicImage.type,
          base64: thematicImage.base64,
        };
        console.log(`🖼️ Adding thematic image to post: ${thematicImage.name}`);
      }

      // Добавляем файлы в 15% случаев
      if (Math.random() < 0.15) {
        const textFile = this.generateTextFile(postIndex);
        postData.file = {
          name: textFile.name,
          type: textFile.type,
          base64: textFile.base64,
        };
        console.log(`📄 Adding text file to post: ${textFile.name}`);
      }
    } else {
      console.log(`📝 Text-only post ${postIndex + 1} (media disabled)`);
    }

    return postData;
  }

  /**
   * ОБНОВЛЕННАЯ генерация тематических изображений
   */
  private generateThematicImage(index: number): { name: string; type: string; base64: string } {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Cannot create canvas context');
    }
    
    const theme = getImageThemeByIndex(index);
    
    // Создаем тематический градиент
    const gradient = ctx.createRadialGradient(200, 200, 0, 200, 200, 200);
    gradient.addColorStop(0, theme.bg[0]);
    gradient.addColorStop(1, theme.bg[1]);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 400);
    
    // Добавляем тематические эффекты
    this.drawThematicEffects(ctx, 400, theme);
    
    // Основной контент
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    
    // Большой эмодзи
    ctx.font = '100px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(theme.emoji, 200, 150);
    
    // Японский/английский текст
    ctx.font = 'bold 48px Arial';
    ctx.fillText(theme.japaneseText, 200, 220);
    
    // Название темы
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = theme.accent;
    ctx.fillText(theme.name, 200, 260);
    
    // Категория
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '18px Arial';
    ctx.fillText(`${theme.category.toUpperCase()}`, 200, 290);
    
    // Номер изображения
    ctx.font = '16px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(`#${index + 1}`, 200, 350);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
    
    return {
      name: `${theme.category}_${theme.name.toLowerCase().replace(/\s+/g, '_')}_${index + 1}.jpg`,
      type: 'image/jpeg',
      base64,
    };
  }

  /**
   * Рисование тематических эффектов
   */
  private drawThematicEffects(ctx: CanvasRenderingContext2D, size: number, theme: ImageTheme) {
    const effectType = theme.category;
    
    switch (effectType) {
      case 'anime':
        this.drawAnimeEffects(ctx, size, theme.accent);
        break;
      case 'culture':
        this.drawCultureEffects(ctx, size, theme.accent);
        break;
      case 'tech':
        this.drawTechEffects(ctx, size, theme.accent);
        break;
      case 'travel':
        this.drawTravelEffects(ctx, size, theme.accent);
        break;
      case 'science':
        this.drawScienceEffects(ctx, size, theme.accent);
        break;
      case 'art':
        this.drawArtEffects(ctx, size, theme.accent);
        break;
    }
  }

  private drawAnimeEffects(ctx: CanvasRenderingContext2D, size: number, color: string) {
    // Энергетические сферы (Dragon Ball style)
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const x = Math.sin(i * Math.PI / 4) * size * 0.3 + size / 2;
      const y = Math.cos(i * Math.PI / 4) * size * 0.3 + size / 2;
      const radius = 15 + Math.sin(i) * 10;
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCultureEffects(ctx: CanvasRenderingContext2D, size: number, color: string) {
    // Лепестки сакуры
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const rotation = Math.random() * Math.PI * 2;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
    ctx.restore();
  }

  private drawTechEffects(ctx: CanvasRenderingContext2D, size: number, color: string) {
    // Технологические линии
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * size, Math.random() * size);
      ctx.lineTo(Math.random() * size, Math.random() * size);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTravelEffects(ctx: CanvasRenderingContext2D, size: number, color: string) {
    // Облака/горы
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;
    
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size * 0.3 + size * 0.6;
      
      ctx.beginPath();
      ctx.arc(x, y, 20 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawScienceEffects(ctx: CanvasRenderingContext2D, size: number, color: string) {
    // Молекулы/атомы
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      
      // Центральная точка
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Орбиты
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.arc(x, y, 15 + j * 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawArtEffects(ctx: CanvasRenderingContext2D, size: number, color: string) {
    // Художественные мазки
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.4;
    
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const startX = Math.random() * size;
      const startY = Math.random() * size;
      ctx.moveTo(startX, startY);
      
      for (let j = 0; j < 5; j++) {
        ctx.lineTo(
          startX + (Math.random() - 0.5) * 100,
          startY + (Math.random() - 0.5) * 100
        );
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * ОБНОВЛЕННАЯ генерация текстовых файлов с тематическим контентом
   */
  private generateTextFile(index: number): { name: string; type: string; base64: string } {
    const themes = [
      'anime_discussion',
      'japan_culture_notes',
      'technology_research',
      'travel_journal',
      'science_facts',
      'art_inspiration'
    ];
    
    const theme = themes[index % themes.length];
    const baseContent = getRandomText(index);
    
    const content = `=== ${theme.toUpperCase().replace('_', ' ')} DOCUMENT ===

${baseContent}

=== METADATA ===
Generated: ${new Date().toISOString()}
Document #: ${index + 1}
Theme: ${theme}
Type: Text Document
Purpose: Testing file upload functionality

=== ADDITIONAL NOTES ===
This document contains thematic content for testing purposes.
Generated by automated test data generator.

Topics covered:
- Cultural discussions
- Technology insights  
- Travel experiences
- Scientific concepts
- Artistic expressions

Total length: ~${baseContent.length + 500} characters
Encoding: UTF-8
Language: Mixed (English/Japanese terms)

=== END OF DOCUMENT ===`;

    const base64 = btoa(unescape(encodeURIComponent(content)));
    
    return {
      name: `${theme}_${index + 1}.txt`,
      type: 'text/plain',
      base64,
    };
  }
async createPostsWithMedia(
  userName: string,
  token: string,
  userId: string,
  postsCount: number,
  mode: 'normal' | 'crash' = 'normal'
): Promise<PostCreationStats> {
  const modeConfig = this.config.modes[mode];

  return new Promise((resolve, reject) => {
    // Используем обновлённый метод создания сокета
    const postSocket = this.createSocket('/posts', token);

    if (!postSocket) {
      reject(new Error('Failed to create socket'));
      return;
    }

    const stats: PostCreationStats = {
      created: 0,
      queued: 0,
      rateLimited: 0,
      errors: 0,
    };

    const startTime = Date.now();

    const cleanup = () => {
      postSocket.disconnect();
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`⏱️ ${userName} completed in ${duration}s`);
      console.log(`📊 ${userName} STATS: ✅${stats.created} 📦${stats.queued} 🚫${stats.rateLimited} ❌${stats.errors}`);
      resolve(stats);
    };

    const checkCompletion = () => {
      const total = stats.created + stats.queued + stats.rateLimited + stats.errors;
      if (total >= postsCount) {
        setTimeout(cleanup, 500);
      }
    };

    postSocket.on('connect', async () => {
      console.log(`📡 ${userName}: Connected to /posts with testDataGeneration flag (${mode} mode, ${this.saveToDatabase ? 'REAL DB' : 'TEST'} )`);

      // Проверим, что в параметрах запроса есть testDataGeneration
      const socketParams = (postSocket as { io?: { opts?: { query?: Record<string, string> } } }).io?.opts?.query;
      if (socketParams) {
        console.log(`📡 Socket params: testDataGeneration=${socketParams.testDataGeneration}`);
      }
        // Создаем посты с интервалами
        for (let j = 0; j < postsCount; j++) {
          const delayMs = mode === 'crash'
            ? j * modeConfig.delayBetweenPosts
            : modeConfig.delayBetweenPosts + (Math.random() * modeConfig.delayVariation);

          setTimeout(() => {
            if (!postSocket.connected) {
              stats.errors++;
              checkCompletion();
              return;
            }

            const postData = this.generateSimplePost(j, userId, userName);

            console.log(`📤 ${userName}: Sending post ${j + 1}/${postsCount}`);

            postSocket.emit('addPost', postData, (postResponse: {
              success: boolean;
              message: string;
              postId?: string;
              queued?: boolean;
              rateLimited?: boolean;
              retryAfter?: number;
              currentCount?: number;
              maxPosts?: number;
            }) => {
              if (postResponse.success) {
                if (postResponse.queued) {
                  stats.queued++;
                  console.log(`📦 ${userName}: Post ${j + 1} → QUEUE`);
                } else {
                  stats.created++;
                  console.log(`✅ ${userName}: Post ${j + 1} → CREATED`);
                }
              } else {
                if (postResponse.rateLimited || postResponse.message.includes('Rate limit')) {
                  stats.rateLimited++;
                  console.log(`🚫 ${userName}: Post ${j + 1} → RATE LIMITED`);
                } else {
                  stats.errors++;
                  console.log(`❌ ${userName}: Post ${j + 1} → ERROR: ${postResponse.message}`);
                }
              }
              checkCompletion();
            });
          }, delayMs);
        }

        // Таймаут безопасности
        setTimeout(() => {
          const total = stats.created + stats.queued + stats.rateLimited + stats.errors;
          if (total < postsCount) {
            console.warn(`⚠️ ${userName}: Force completion ${total}/${postsCount}`);
            cleanup();
          }
        }, this.config.timeouts.operation * modeConfig.timeoutMultiplier);
      });

      postSocket.on('connect_error', (error: Error) => {
        console.error(`❌ ${userName}: Posts socket error:`, error.message);
        reject(error);
      });
    });
  }
}