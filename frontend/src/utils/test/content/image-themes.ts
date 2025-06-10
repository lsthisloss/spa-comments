/**
 * Темы и данные для генерации изображений
 */

export interface ImageTheme {
  name: string;
  bg: [string, string]; // Градиент
  accent: string;
  emoji: string;
  japaneseText: string;
  category: 'meme' | 'tech' | 'space' | 'art' | 'vibe' | 'retro';
}

export const IMAGE_THEMES: ImageTheme[] = [
  // Мемы и фан
  {
    name: 'Doge Vibes',
    bg: ['#FFE135', '#FFA726'],
    accent: '#8D6E63',
    emoji: '🐕',
    japaneseText: 'ワオ',
    category: 'meme'
  },
  {
    name: 'Stonks',
    bg: ['#00C853', '#4CAF50'],
    accent: '#E8F5E8',
    emoji: '📈',
    japaneseText: '株価',
    category: 'meme'
  },
  {
    name: 'Big Brain',
    bg: ['#9C27B0', '#E1BEE7'],
    accent: '#F3E5F5',
    emoji: '🧠',
    japaneseText: '大脳',
    category: 'meme'
  },
  {
    name: 'Pepe Energy',
    bg: ['#4CAF50', '#81C784'],
    accent: '#E8F5E8',
    emoji: '🐸',
    japaneseText: 'カエル',
    category: 'meme'
  },
  {
    name: 'This is Fine',
    bg: ['#FF5722', '#FF8A65'],
    accent: '#FFCCBC',
    emoji: '🔥',
    japaneseText: '大丈夫',
    category: 'meme'
  },
  {
    name: 'Distracted Boyfriend',
    bg: ['#2196F3', '#64B5F6'],
    accent: '#E3F2FD',
    emoji: '👀',
    japaneseText: '見る',
    category: 'meme'
  },

  // Технологии
  {
    name: 'Cyberpunk Neon',
    bg: ['#FF00FF', '#00FFFF'],
    accent: '#000000',
    emoji: '🌃',
    japaneseText: 'サイバー',
    category: 'tech'
  },
  {
    name: 'Matrix Code',
    bg: ['#00FF00', '#008000'],
    accent: '#000000',
    emoji: '💊',
    japaneseText: 'マトリックス',
    category: 'tech'
  },
  {
    name: 'Synthwave',
    bg: ['#FF1493', '#9400D3'],
    accent: '#FFB6C1',
    emoji: '🌆',
    japaneseText: 'シンセ',
    category: 'tech'
  },
  {
    name: 'Hacker Terminal',
    bg: ['#000000', '#1B5E20'],
    accent: '#00FF00',
    emoji: '💻',
    japaneseText: 'ハッカー',
    category: 'tech'
  },
  {
    name: 'Glitch Art',
    bg: ['#FF0080', '#8000FF'],
    accent: '#FFFFFF',
    emoji: '📺',
    japaneseText: 'グリッチ',
    category: 'tech'
  },

  // Космос
  {
    name: 'Galaxy Brain',
    bg: ['#1A0033', '#4A0080'],
    accent: '#FFD700',
    emoji: '🌌',
    japaneseText: '銀河',
    category: 'space'
  },
  {
    name: 'Black Hole',
    bg: ['#000000', '#1A1A1A'],
    accent: '#FF6B00',
    emoji: '🕳️',
    japaneseText: 'ブラックホール',
    category: 'space'
  },
  {
    name: 'Mars Mission',
    bg: ['#CD5C5C', '#A0522D'],
    accent: '#FFE4B5',
    emoji: '🚀',
    japaneseText: '火星',
    category: 'space'
  },
  {
    name: 'Nebula Dreams',
    bg: ['#4B0082', '#FF1493'],
    accent: '#FFB6C1',
    emoji: '☄️',
    japaneseText: '星雲',
    category: 'space'
  },
  {
    name: 'UFO Sighting',
    bg: ['#008000', '#32CD32'],
    accent: '#FFFFFF',
    emoji: '🛸',
    japaneseText: 'UFO',
    category: 'space'
  },

  // Арт и эстетика
  {
    name: 'Vaporwave',
    bg: ['#FF1493', '#8A2BE2'],
    accent: '#FFB6C1',
    emoji: '🏛️',
    japaneseText: 'ベイパーウェーブ',
    category: 'art'
  },
  {
    name: 'Pixel Art',
    bg: ['#FF6B6B', '#4ECDC4'],
    accent: '#FFE66D',
    emoji: '🎮',
    japaneseText: 'ピクセル',
    category: 'art'
  },
  {
    name: 'Neon Lights',
    bg: ['#FF0080', '#0080FF'],
    accent: '#FFFFFF',
    emoji: '💡',
    japaneseText: 'ネオン',
    category: 'art'
  },
  {
    name: 'Graffiti Style',
    bg: ['#FF4500', '#FFD700'],
    accent: '#000000',
    emoji: '🎨',
    japaneseText: 'グラフィティ',
    category: 'art'
  },

  // Вайбы
  {
    name: 'Chill Vibes',
    bg: ['#87CEEB', '#98FB98'],
    accent: '#FFFFFF',
    emoji: '😎',
    japaneseText: 'チル',
    category: 'vibe'
  },
  {
    name: 'Midnight Mood',
    bg: ['#191970', '#000080'],
    accent: '#C0C0C0',
    emoji: '🌙',
    japaneseText: '真夜中',
    category: 'vibe'
  },
  {
    name: 'Summer Energy',
    bg: ['#FF8C00', '#FF1493'],
    accent: '#FFFF00',
    emoji: '☀️',
    japaneseText: '夏',
    category: 'vibe'
  },
  {
    name: 'Cozy Coffee',
    bg: ['#8B4513', '#D2691E'],
    accent: '#F5DEB3',
    emoji: '☕',
    japaneseText: 'コーヒー',
    category: 'vibe'
  },

  // Ретро
  {
    name: '80s Aesthetic',
    bg: ['#FF1493', '#00CED1'],
    accent: '#FFD700',
    emoji: '📼',
    japaneseText: '80年代',
    category: 'retro'
  },
  {
    name: 'Arcade Nostalgia',
    bg: ['#8A2BE2', '#FF4500'],
    accent: '#FFFF00',
    emoji: '🕹️',
    japaneseText: 'アーケード',
    category: 'retro'
  },
  {
    name: 'VHS Memories',
    bg: ['#4B0082', '#FF6347'],
    accent: '#F0E68C',
    emoji: '📹',
    japaneseText: 'VHS',
    category: 'retro'
  },
  {
    name: 'Outrun Highway',
    bg: ['#FF0080', '#8000FF'],
    accent: '#FFD700',
    emoji: '🏎️',
    japaneseText: 'アウトラン',
    category: 'retro'
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
export const IMAGE_CATEGORIES = ['meme', 'tech', 'space', 'art', 'vibe', 'retro'] as const;
