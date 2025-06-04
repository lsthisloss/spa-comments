/**
 * Генерация тестовых изображений и файлов
 */

export interface TestImage {
  name: string;
  type: string;
  base64: string;
  size: number;
}

export interface TestFile {
  name: string;
  type: string;
  base64: string;
  size: number;
}

// Создаем простые тестовые изображения программно
export function generateTestAvatar(userName: string, size = 200): TestImage {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Cannot create canvas context');
  }
  
  // Генерируем цвет на основе имени пользователя
  const hash = userName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  
  const bgColor = colors[Math.abs(hash) % colors.length];
  const textColor = '#FFFFFF';
  
  // Рисуем фон
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  
  // Рисуем инициалы
  const initials = userName.slice(0, 2).toUpperCase();
  ctx.fillStyle = textColor;
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, size / 2, size / 2);
  
  const base64 = canvas.toDataURL('image/png').split(',')[1];
  
  return {
    name: `avatar_${userName.toLowerCase()}.png`,
    type: 'image/png',
    base64,
    size: base64.length * 0.75,
  };
}

// АНИМЕ-ТЕМАТИЧЕСКИЕ ИЗОБРАЖЕНИЯ ДЛЯ ПОСТОВ
export function generateTestPostImage(index: number, size = 400): TestImage {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Cannot create canvas context');
  }
  
  // АНИМЕ-СТИЛИ И ТЕМЫ
  const animeThemes: AnimeTheme[] = [
    {
      name: 'Naruto Orange',
      bg: ['#FF6B35', '#F7931E'] as [string, string],
      accent: '#FFE066',
      text: 'ナルト',
      emoji: '🍜'
    },
    {
      name: 'Dragon Ball Blue',
      bg: ['#1E3A8A', '#3B82F6'] as [string, string],
      accent: '#FCD34D',
      text: '悟空',
      emoji: '⚡'
    },
    {
      name: 'Sasuke Purple',
      bg: ['#5B21B6', '#8B5CF6'] as [string, string],
      accent: '#EC4899',
      text: 'サスケ',
      emoji: '⚡'
    },
    {
      name: 'Attack Titan',
      bg: ['#DC2626', '#EF4444'] as [string, string],
      accent: '#FEF3C7',
      text: '進撃',
      emoji: '⚔️'
    },
    {
      name: 'One Piece Sea',
      bg: ['#0369A1', '#0EA5E9'] as [string, string],
      accent: '#FDE047',
      text: '海賊',
      emoji: '🏴‍☠️'
    },
    {
      name: 'Demon Slayer',
      bg: ['#065F46', '#059669'] as [string, string],
      accent: '#FCA5A5',
      text: '鬼殺',
      emoji: '⚡'
    },
    {
      name: 'My Hero Academia',
      bg: ['#15803D', '#22C55E'] as [string, string],
      accent: '#FEF08A',
      text: 'ヒーロー',
      emoji: '💪'
    },
    {
      name: 'Jujutsu Kaisen',
      bg: ['#7C2D12', '#EA580C'] as [string, string],
      accent: '#A3A3A3',
      text: '呪術',
      emoji: '👹'
    }
  ];
  
  const theme = animeThemes[index % animeThemes.length];
  
  // СОЗДАЕМ АНИМЕ-СТИЛЬ ГРАДИЕНТ
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  gradient.addColorStop(0, theme.bg[0]);
  gradient.addColorStop(1, theme.bg[1]);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // ДОБАВЛЯЕМ АНИМЕ-ПАТТЕРНЫ И ЭФФЕКТЫ
  drawAnimeEffects(ctx, size, theme, index);
  
  // ОСНОВНОЙ ТЕКСТ В СТИЛЕ АНИМЕ
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  // Большой эмодзи
  ctx.font = `${size * 0.25}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(theme.emoji, size / 2, size / 3);
  
  // Японский текст
  ctx.font = `bold ${size * 0.12}px Arial`;
  ctx.fillText(theme.text, size / 2, size / 2);
  
  // Английский подзаголовок
  ctx.font = `bold ${size * 0.06}px Arial`;
  ctx.fillStyle = theme.accent;
  ctx.fillText(theme.name, size / 2, size / 2 + size * 0.1);
  
  // Номер изображения
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = `${size * 0.05}px Arial`;
  ctx.fillText(`#${index + 1}`, size / 2, size * 0.85);
  
  const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  
  return {
    name: `anime_${theme.name.toLowerCase().replace(/\s+/g, '_')}_${index + 1}.jpg`,
    type: 'image/jpeg',
    base64,
    size: base64.length * 0.75,
  };
}

// ФУНКЦИЯ ДЛЯ РИСОВАНИЯ АНИМЕ-ЭФФЕКТОВ
interface AnimeTheme {
  name: string;
  bg: [string, string];
  accent: string;
  text: string;
  emoji: string;
}

function drawAnimeEffects(ctx: CanvasRenderingContext2D, size: number, theme: AnimeTheme, index: number) {
  const effectType = index % 4;
  
  switch (effectType) {
    case 0: // ЭНЕРГЕТИЧЕСКИЕ СФЕРЫ (Dragon Ball style)
      drawEnergyOrbs(ctx, size, theme.accent);
      break;
    case 1: // МОЛНИИ (Naruto/Sasuke style)
      drawLightningBolts(ctx, size, theme.accent);
      break;
    case 2: // ЛЕПЕСТКИ САКУРЫ
      drawSakuraPetals(ctx, size, theme.accent);
      break;
    case 3: // ГЕОМЕТРИЧЕСКИЕ ПАТТЕРНЫ
      drawGeometricPattern(ctx, size, theme.accent);
      break;
  }
}

function drawEnergyOrbs(ctx: CanvasRenderingContext2D, size: number, color: string) {
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

function drawLightningBolts(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const startX = Math.random() * size;
    const startY = Math.random() * size * 0.3;
    
    ctx.moveTo(startX, startY);
    
    // Создаем зигзагообразную молнию
    let x = startX;
    let y = startY;
    
    for (let j = 0; j < 8; j++) {
      x += (Math.random() - 0.5) * 40;
      y += size * 0.1;
      ctx.lineTo(x, y);
    }
    
    ctx.stroke();
  }
  ctx.restore();
}

function drawSakuraPetals(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7;
  
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rotation = Math.random() * Math.PI * 2;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    // Рисуем лепесток сакуры
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  ctx.restore();
}

function drawGeometricPattern(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  
  // Рисуем шестиугольные паттерны
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12;
    const x = Math.sin(angle) * size * 0.4 + size / 2;
    const y = Math.cos(angle) * size * 0.4 + size / 2;
    
    drawHexagon(ctx, x, y, 20);
  }
  ctx.restore();
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const px = x + Math.sin(angle) * radius;
    const py = y + Math.cos(angle) * radius;
    
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.stroke();
}

// Генерация ТОЛЬКО TXT файлов
export function generateTestFile(index: number): TestFile {
  const textContents = [
    'This is a test document file with some interesting content about technology and innovation.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Testing file upload functionality with various text content. This file contains important information for testing purposes.',
    'Sample text document for testing the file upload system. Contains multiple lines and paragraphs for comprehensive testing.',
    'Technical documentation sample. This file demonstrates proper text formatting and content structure for testing.',
  ];
  
  const baseContent = textContents[index % textContents.length];
  
  const content = `${baseContent}

=== FILE METADATA ===
Generated at: ${new Date().toISOString()}
File index: ${index + 1}
File type: Plain Text Document
Test purpose: File upload functionality testing

=== ADDITIONAL CONTENT ===
This is a generated test file created by the automated test data generator.
It contains sample text content to verify file upload and storage capabilities.

Line 1: Test data generation
Line 2: File upload verification  
Line 3: Content integrity check
Line 4: System functionality test
Line 5: End of test content

Total characters: ${baseContent.length + 400} (approximate)
Generated for testing purposes only.`;

  // Правильная UTF-8 кодировка для русского текста
  const base64 = btoa(unescape(encodeURIComponent(content)));
  
  return {
    name: `test_document_${index + 1}.txt`,
    type: 'text/plain',
    base64,
    size: base64.length * 0.75,
  };
}

// Готовая коллекция изображений
export const TEST_IMAGES_COLLECTION = [
  'naruto_orange_1.jpg',
  'dragon_ball_blue_2.jpg', 
  'sasuke_purple_3.jpg',
  'attack_titan_4.jpg',
  'one_piece_sea_5.jpg',
  'demon_slayer_6.jpg',
  'my_hero_academia_7.jpg',
  'jujutsu_kaisen_8.jpg',
];

// Случайный выбор изображения
export function getRandomTestImage(index: number): TestImage {
  // Используем детерминированную генерацию для консистентности
  return generateTestPostImage(index);
}

export function getRandomTestFile(index: number): TestFile {
  return generateTestFile(index);
}

// Проверка поддержки Canvas
export function isCanvasSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext && canvas.getContext('2d'));
  } catch {
    return false;
  }
}