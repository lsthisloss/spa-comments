import io from 'socket.io-client';
import { randomUserName } from './generators';
import { TestConfig } from './config';
import { testService } from '../../services/test/TestService';
import { getRandomText, getRandomTextSampled } from './content/content-data';
import { getImageThemeByIndex, ImageTheme } from './content/image-themes';

/**
 * Интерфейс для результата создания пользователя
 */
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

/*
  Генератор тестовых пользователей и постов для тестирования функционала
  Создает пользователей, посты и медиа-контент с возможностью настройки параметров
*/

export class TestUserGenerator {
  private config: TestConfig;
  private generateWithMedia: boolean;

  constructor(config: TestConfig, saveToDatabase: boolean = true, generateWithMedia: boolean = true) {
    this.config = config;
    this.generateWithMedia = generateWithMedia;

    if (saveToDatabase) {
      console.log(`💾 Real mode: data will be saved to database`);
    } else {
      console.log(`⚡ Test mode: using mock data, no database saves`);
      testService.setTestEnvironment(config);
    }

    console.log(`📷 Media generation: ${generateWithMedia ? 'ENABLED' : 'DISABLED'}`);
  }

/*
    Создание пользователя с уникальным именем и email.
    Возвращает объект с результатом регистрации.
*/
  async createUser(userIndex: number, prefix = 'testuser'): Promise<UserCreationResult> {
    // Создаем осмысленное имя пользователя
    const userName = randomUserName();

    const userData = {
      email: `${prefix}_${Date.now()}_${userIndex}@sk8.pw`,
      userName,
      password: 'asdyt1Aq4edf*',
      testDataGeneration: true
    };

    return new Promise((resolve, reject) => {
      // Создаем сокет с уникальным ID для предотвращения коллизий
      const userSocket = this.createSocket('/users');

      if (!userSocket) {
        reject(new Error('Failed to create socket'));
        return;
      }

      // Увеличиваем таймаут для большей надежности
      const operationTimeout = setTimeout(() => {
        if (userSocket.connected) {
          userSocket.disconnect();
        }
        reject(new Error('Operation timeout'));
      }, this.config.timeouts.operation);

      // Обработка соединения
      userSocket.on('connect', () => {

        userSocket.emit('register', userData, async (registerResponse: {
          token?: string;
          user?: { id?: string };
          message?: string;
          success?: boolean;
        }) => {
          try {
            clearTimeout(operationTimeout);

            if (registerResponse.success && registerResponse.token && registerResponse.user?.id) {

              userSocket.disconnect();

              resolve({
                success: true,
                user: {
                  id: registerResponse.user.id,
                  userName: userData.userName,
                  token: registerResponse.token,
                },
              });
            } else {
              console.warn(`[TestGen] Registration failed for ${userName}:`, registerResponse.message);

              userSocket.disconnect();

              resolve({
                success: false,
                error: registerResponse.message || 'Registration failed',
              });
            }
          } catch (error) {
            console.warn(`[TestGen] Error processing registration for ${userData.userName}:`, error);

            userSocket.disconnect();
            clearTimeout(operationTimeout);

            reject(error);
          }
        });
      });

      // Обработка ошибок соединения
      userSocket.on('connect_error', (error: Error) => {
        clearTimeout(operationTimeout);
        userSocket.disconnect();
        reject(error);
      });

    });
  }

  /*
    Создание сокета с уникальным ID для предотвращения коллизий
  */
  private createSocket(namespace: string, token?: string) {
    try {
      // Уникальный ID для каждого сокета, чтобы избежать переиспользования
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const socketConfig: {
        transports: string[];
        reconnectionAttempts: number;
        reconnectionDelay: number;
        timeout: number;
        query: Record<string, string>;
        auth: Record<string, string | boolean>;
        forceNew: boolean;
      } = {
        transports: ['websocket'],
        reconnectionAttempts: 0,
        reconnectionDelay: 1000,
        timeout: 10000,
        forceNew: true,
        query: {
          testDataGeneration: 'true',
          testToken: 'sk8-h4ck-t0k3n-1337',
          clientId: uniqueId
        },
        auth: {
          testDataGeneration: 'true',
          testToken: 'sk8-h4ck-t0k3n-1337',
        }
      };

      if (token) {
        socketConfig.auth = {
          ...socketConfig.auth,
          token
        };
      }

      const url = `${this.config.socketURL}${namespace}`;

      const socket = io(url, socketConfig);

      socket.on('error', (error: unknown) => {
        console.warn(`[TestGen] Socket error for ${namespace}:`, error);
      });

      socket.on('connect_error', (error: Error) => {
        console.warn(`[TestGen] Socket connect error for ${namespace}:`, error);
      });

      // Safely set max listeners if the method exists (runtime check)
      const socketWithMaxListeners = socket as typeof socket & { setMaxListeners?: (n: number) => void };
      if (typeof socketWithMaxListeners.setMaxListeners === 'function') {
        socketWithMaxListeners.setMaxListeners(20);
      }

      return socket;
    } catch (error) {
      console.warn(`[TestGen] Error creating socket for ${namespace}:`, error);
      return null;
    }
  }

  /**
   * Генерация простого поста без сложных медиа-файлов
   */
  private generateSimplePost(postIndex: number, userId: string, userName: string): PostData {
    // Используем семплированную версию с userId как seed
    const userSeed = parseInt(userId.slice(-4), 16) || 1; // Берем последние символы ID как seed
    const content = getRandomTextSampled(postIndex, userSeed);

    const postData: PostData = {
      content,
      userId,
      userName,
    };

    // проверяем флаг generateWithMedia
    if (this.generateWithMedia) {
      // Добавляем тематическое изображение в 40% случаев  
      if (Math.random() < 0.4) {
        const thematicImage = this.generateThematicImage(postIndex);
        postData.image = {
          name: thematicImage.name,
          type: thematicImage.type,
          base64: thematicImage.base64,
        };
      }

      // Добавляем файлы в 15% случаев
      if (Math.random() < 0.15) {
        const textFile = this.generateTextFile(postIndex);
        postData.file = {
          name: textFile.name,
          type: textFile.type,
          base64: textFile.base64,
        };
      }
    }

    return postData;
  }

  /**
   * Генерация тематических изображений
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
   * Отрисовка тематических эффектов
   */
  private drawThematicEffects(ctx: CanvasRenderingContext2D, size: number, theme: ImageTheme) {
    const effectType = theme.category;

    switch (effectType) {
      case 'meme':
        this.drawAnimeEffects(ctx, size, theme.accent);
        break;
      case 'vibe':
        this.drawCultureEffects(ctx, size, theme.accent);
        break;
      case 'tech':
        this.drawTechEffects(ctx, size, theme.accent);
        break;
      case 'space':
        this.drawTravelEffects(ctx, size, theme.accent);
        break;
      case 'retro':
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
   * Генерация текстовых файлов с тематическим контентом
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
  // Метод создания постов, чтобы использовал только один сокет

  async createPostsWithMedia(
    userName: string,
    token: string,
    userId: string,
    postsCount: number,
    mode: 'normal' | 'crash' = 'normal'
  ): Promise<PostCreationStats> {
    const modeConfig = this.config.modes[mode];

    return new Promise((resolve, reject) => {
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

      let completedPosts = 0;

      const cleanup = () => {
        if (postSocket.connected) {
          postSocket.disconnect();
        }
        resolve(stats);
      };

      const checkCompletion = () => {
        if (completedPosts >= postsCount) {
          setTimeout(cleanup, 100); // Быстрее cleanup
        }
      };

      postSocket.on('connect', async () => {
        // КРАШ-РЕЖИМ: Отправляем ВСЕ посты ОДНОВРЕМЕННО!
        if (mode === 'crash') {
          console.log(`🔥 [${userName}] CRASH MODE: Sending ${postsCount} posts SIMULTANEOUSLY!`);

          for (let j = 0; j < postsCount; j++) {
            // БЕЗ setTimeout - отправляем все сразу!
            const postData = this.generateSimplePost(j, userId, userName);

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
                } else {
                  stats.created++;
                }
              } else {
                if (postResponse.rateLimited || postResponse.message.includes('Rate limit')) {
                  stats.rateLimited++;
                } else {
                  stats.errors++;
                }
              }

              completedPosts++;
              checkCompletion();
            });
          }
        } else {
          // ОБЫЧНЫЙ режим с задержками
          for (let j = 0; j < postsCount; j++) {
            const delayMs = j * modeConfig.delayBetweenPosts + (Math.random() * modeConfig.delayVariation);

            setTimeout(() => {
              if (!postSocket.connected) {
                stats.errors++;
                completedPosts++;
                checkCompletion();
                return;
              }

              const postData = this.generateSimplePost(j, userId, userName);

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
                  } else {
                    stats.created++;
                  }
                } else {
                  if (postResponse.rateLimited || postResponse.message.includes('Rate limit')) {
                    stats.rateLimited++;
                  } else {
                    stats.errors++;
                  }
                }

                completedPosts++;
                checkCompletion();
              });
            }, delayMs);
          }
        }

        // Таймаут безопасности
        setTimeout(() => {
          if (completedPosts < postsCount) {
            console.warn(`[TestGen] ⚠️ ${userName}: Force completion ${completedPosts}/${postsCount}`);
            completedPosts = postsCount;
            cleanup();
          }
        }, mode === 'crash' ? 30000 : this.config.timeouts.operation * modeConfig.timeoutMultiplier);
      });

      postSocket.on('connect_error', (error: Error) => {
        console.warn(`[TestGen] ${userName}: Posts socket connection error:`, error.message);
        reject(error);
      });

      postSocket.on('disconnect', () => {
        if (completedPosts < postsCount) {
          completedPosts = postsCount;
          resolve(stats);
        }
      });
    });
  }
}