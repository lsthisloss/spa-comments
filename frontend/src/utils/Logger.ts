// Определяем уровни логирования
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4
}

class Logger {
  // Текущий уровень логирования (можно менять в runtime)
  private logLevel: LogLevel = process.env.NODE_ENV === 'production' 
    ? LogLevel.WARN  // В продакшене только ошибки и предупреждения
    : LogLevel.INFO;  // В разработке - информационные сообщения
  
  // Флаг для предотвращения дублирования логов
  private recentLogs: Map<string, number> = new Map();
  private readonly LOG_EXPIRY_TIME = 2000; // 2 секунды
  private readonly LOG_THROTTLE_MAP = new Map<string, number>();
  private readonly THROTTLE_INTERVAL = 5000; // 5 секунд

  // Метод для изменения уровня логирования
  setLogLevel(level: LogLevel) {
    this.logLevel = level;
    this.info(`Log level set to ${LogLevel[level]}`);
  }
  
  // Проверка, нужно ли логировать сообщение
  private shouldLog(message: string, level: LogLevel): boolean {
    // Если уровень слишком низкий для текущих настроек - пропускаем
    if (level > this.logLevel) return false;
    
    // Проверяем дубликаты
    const key = `${level}:${message}`;
    const now = Date.now();
    const lastTime = this.recentLogs.get(key);
    
    if (lastTime && now - lastTime < this.LOG_EXPIRY_TIME) {
      // Это дубликат сообщения, логируем только раз в 2 секунды
      return false;
    }
    
    // Обновляем время последнего лога
    this.recentLogs.set(key, now);
    
    // Очистка старых записей (каждые 100 логов)
    if (this.recentLogs.size > 100) {
      this.cleanupOldLogs();
    }
    
    return true;
  }
  
  error(message: string, ...args: unknown[]) {
    if (this.shouldLog(message, LogLevel.ERROR)) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

warn(message: string, ...args: unknown[]) {
  const key = `WARN:${message}`;
  const now = Date.now();
  const lastLog = this.LOG_THROTTLE_MAP.get(key) || 0;
  
  // Если такое предупреждение уже было недавно, не показываем его снова
  if (now - lastLog < this.THROTTLE_INTERVAL) {
    return;
  }
  
  this.LOG_THROTTLE_MAP.set(key, now);
  console.warn(`[WARN] ${message}`, ...args);
}

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog(message, LogLevel.INFO)) {
      console.log(`${message}`, ...args);
    }
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog(message, LogLevel.DEBUG)) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  verbose(message: string, ...args: unknown[]) {
    if (this.shouldLog(message, LogLevel.VERBOSE)) {
      console.log(`[VERBOSE] ${message}`, ...args);
    }
  }

  // Для обратной совместимости
  log(message: string, ...args: unknown[]) {
    this.info(message, ...args);
  }

  // Метод для очистки старых записей из recentLogs
  private cleanupOldLogs() {
    const now = Date.now();
    for (const [key, timestamp] of this.recentLogs.entries()) {
      if (now - timestamp > this.LOG_EXPIRY_TIME) {
        this.recentLogs.delete(key);
      }
    }
  }
}

export const logger = new Logger();

// Расширяем интерфейс Window для разработки
declare global {
  interface Window {
    setLogLevel?: (level: LogLevel | string) => void;
  }
}

// Специальный метод для разработки
if (process.env.NODE_ENV !== 'production') {
  window.setLogLevel = (level: LogLevel | string) => {
    if (typeof level === 'string') {
      const levelEnum = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
      if (levelEnum !== undefined) {
        logger.setLogLevel(levelEnum);
      } else {
        console.warn(`Invalid log level: ${level}`);
      }
    } else {
      logger.setLogLevel(level);
    }
  };
}