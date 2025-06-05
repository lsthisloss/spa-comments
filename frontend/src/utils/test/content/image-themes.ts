/**
 * Темы и данные для генерации изображений
 */

export interface ImageTheme {
  name: string;
  bg: [string, string]; // Градиент
  accent: string;
  emoji: string;
  japaneseText: string;
  category: 'anime' | 'culture' | 'tech' | 'travel' | 'science' | 'art';
}

export const IMAGE_THEMES: ImageTheme[] = [
  // Аниме темы
  {
    name: 'Naruto',
    bg: ['#FF6B35', '#F7931E'],
    accent: '#FFE066',
    emoji: '🍜',
    japaneseText: 'ナルト',
    category: 'anime'
  },
  {
    name: 'Dragon Ball',
    bg: ['#1E3A8A', '#3B82F6'],
    accent: '#FCD34D',
    emoji: '⚡',
    japaneseText: '悟空',
    category: 'anime'
  },
  {
    name: 'Sasuke',
    bg: ['#5B21B6', '#8B5CF6'],
    accent: '#EC4899',
    emoji: '👁️',
    japaneseText: 'サスケ',
    category: 'anime'
  },
  {
    name: 'Attack Titan',
    bg: ['#DC2626', '#EF4444'],
    accent: '#FEF3C7',
    emoji: '⚔️',
    japaneseText: '進撃',
    category: 'anime'
  },
  {
    name: 'One Piece',
    bg: ['#0369A1', '#0EA5E9'],
    accent: '#FDE047',
    emoji: '🏴‍☠️',
    japaneseText: '海賊',
    category: 'anime'
  },
  {
    name: 'Demon Slayer',
    bg: ['#065F46', '#059669'],
    accent: '#FCA5A5',
    emoji: '🗡️',
    japaneseText: '鬼殺',
    category: 'anime'
  },

  // Японская культура
  {
    name: 'Sakura',
    bg: ['#F8BBD9', '#E91E63'],
    accent: '#FFE0E6',
    emoji: '🌸',
    japaneseText: '桜',
    category: 'culture'
  },
  {
    name: 'Tea Ceremony',
    bg: ['#4A5D23', '#8BC34A'],
    accent: '#E8F5E8',
    emoji: '🍵',
    japaneseText: '茶道',
    category: 'culture'
  },
  {
    name: 'Mount Fuji',
    bg: ['#2196F3', '#E3F2FD'],
    accent: '#FFFFFF',
    emoji: '🗻',
    japaneseText: '富士山',
    category: 'culture'
  },
  {
    name: 'Zen Garden',
    bg: ['#795548', '#BCAAA4'],
    accent: '#F5F5F5',
    emoji: '🪨',
    japaneseText: '禅',
    category: 'culture'
  },

  // Технологии
  {
    name: 'AI Technology',
    bg: ['#1A237E', '#3F51B5'],
    accent: '#E8EAF6',
    emoji: '🤖',
    japaneseText: 'AI',
    category: 'tech'
  },
  {
    name: 'Quantum Computing',
    bg: ['#4A148C', '#9C27B0'],
    accent: '#F3E5F5',
    emoji: '⚛️',
    japaneseText: '量子',
    category: 'tech'
  },
  {
    name: 'Blockchain',
    bg: ['#E65100', '#FF9800'],
    accent: '#FFF3E0',
    emoji: '⛓️',
    japaneseText: 'ブロック',
    category: 'tech'
  },
  {
    name: 'Cybersecurity',
    bg: ['#B71C1C', '#F44336'],
    accent: '#FFEBEE',
    emoji: '🔒',
    japaneseText: 'セキュリティ',
    category: 'tech'
  },

  // Путешествия
  {
    name: 'Iceland',
    bg: ['#0277BD', '#03A9F4'],
    accent: '#E1F5FE',
    emoji: '🌋',
    japaneseText: 'アイスランド',
    category: 'travel'
  },
  {
    name: 'Bali',
    bg: ['#388E3C', '#4CAF50'],
    accent: '#E8F5E8',
    emoji: '🌺',
    japaneseText: 'バリ',
    category: 'travel'
  },
  {
    name: 'Norway',
    bg: ['#1565C0', '#2196F3'],
    accent: '#E3F2FD',
    emoji: '⛰️',
    japaneseText: 'ノルウェー',
    category: 'travel'
  },
  {
    name: 'Morocco',
    bg: ['#E65100', '#FF9800'],
    accent: '#FFF3E0',
    emoji: '🐪',
    japaneseText: 'モロッコ',
    category: 'travel'
  },

  // Наука
  {
    name: 'Space Telescope',
    bg: ['#1A237E', '#3F51B5'],
    accent: '#E8EAF6',
    emoji: '🌌',
    japaneseText: '宇宙',
    category: 'science'
  },
  {
    name: 'DNA Research',
    bg: ['#2E7D32', '#4CAF50'],
    accent: '#E8F5E8',
    emoji: '🧬',
    japaneseText: 'DNA',
    category: 'science'
  },
  {
    name: 'Brain Science',
    bg: ['#7B1FA2', '#9C27B0'],
    accent: '#F3E5F5',
    emoji: '🧠',
    japaneseText: '脳科学',
    category: 'science'
  },
  {
    name: 'Biotechnology',
    bg: ['#388E3C', '#4CAF50'],
    accent: '#E8F5E8',
    emoji: '🌱',
    japaneseText: 'バイオ',
    category: 'science'
  },

  // Искусство
  {
    name: 'Digital Art',
    bg: ['#7B1FA2', '#9C27B0'],
    accent: '#F3E5F5',
    emoji: '🎨',
    japaneseText: 'デジタル',
    category: 'art'
  },
  {
    name: 'Street Art',
    bg: ['#F57C00', '#FF9800'],
    accent: '#FFF3E0',
    emoji: '🎭',
    japaneseText: 'ストリート',
    category: 'art'
  },
  {
    name: 'Music',
    bg: ['#C2185B', '#E91E63'],
    accent: '#FCE4EC',
    emoji: '🎵',
    japaneseText: '音楽',
    category: 'art'
  },
  {
    name: 'Photography',
    bg: ['#455A64', '#607D8B'],
    accent: '#ECEFF1',
    emoji: '📸',
    japaneseText: '写真',
    category: 'art'
  }
];

// Функция для получения темы по индексу
export function getImageThemeByIndex(index: number): ImageTheme {
  return IMAGE_THEMES[index % IMAGE_THEMES.length];
}

// Функция для получения темы по категории
export function getImageThemeByCategory(category: ImageTheme['category'], index: number): ImageTheme {
  const themesInCategory = IMAGE_THEMES.filter(theme => theme.category === category);
  return themesInCategory[index % themesInCategory.length];
}

// Экспорт категорий
export const IMAGE_CATEGORIES = ['anime', 'culture', 'tech', 'travel', 'science', 'art'] as const;