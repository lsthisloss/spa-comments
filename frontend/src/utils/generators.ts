/**
 * Генераторы случайных данных
 */

export function randomText(length = 30): string {
  const words = [
    'Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur',
    'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor',
    'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna',
    'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis',
    'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi',
    'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis'
  ];
  
  const randomWords: string[] = [];
  const wordsCount = Math.max(1, Math.floor(length / 5));
  
  for (let i = 0; i < wordsCount; i++) {
    randomWords.push(words[Math.floor(Math.random() * words.length)]);
  }
  
  return randomWords.join(' ');
}

export function randomUserName(): string {
  const adjectives = ['Cool', 'Happy', 'Smart', 'Fast', 'Bright', 'Brave', 'Kind', 'Wise', 'Bold', 'Swift'];
  const nouns = ['Cat', 'Dog', 'Fox', 'Bear', 'Wolf', 'Tiger', 'Lion', 'Eagle', 'Shark', 'Dragon'];
  const randomNum = Math.floor(Math.random() * 10000);
  
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${randomNum}`;
}

export function generateUserData(userIndex: number, prefix = 'user'): {
  email: string;
  userName: string;
  password: string;
} {
  return {
    email: `${prefix}_${Date.now()}_${userIndex}@example.com`,
    userName: randomUserName(),
    password: 'Aa112233',
  };
}

export function generatePostData(postIndex: number, userId: string, userName: string): {
  content: string;
  userId: string;
} {
  const contentLength = Math.floor(Math.random() * 200) + 100; // 100-300 символов
  return {
    content: `${randomText(contentLength)} (Post #${postIndex + 1} from ${userName})`,
    userId: userId,
  };
}

export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));