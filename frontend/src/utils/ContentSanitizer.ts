/**
 * Класс для очистки и валидации пользовательского контента
 */
export class ContentSanitizer {
  // Разрешенные HTML теги
  private static readonly ALLOWED_TAGS = ['b', 'i', 'u', 'br'];
  private static readonly MAX_TEXT_LENGTH = 1000;

  /**
   * Очищает и проверяет текстовый контент
   */
  static sanitizeContent(text: string): { valid: boolean; sanitized: string; error?: string } {
    // Base checks
    if (!text || typeof text !== 'string') {
      return { valid: true, sanitized: '' };
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return { valid: true, sanitized: '' };
    }

    // Length check
    if (trimmedText.length > this.MAX_TEXT_LENGTH) {
      return { 
        valid: false, 
        sanitized: '', 
        error: `Content exceeds maximum length of ${this.MAX_TEXT_LENGTH} characters` 
      };
    }

    // Security check for dangerous patterns
    if (this.containsDangerousPatterns(trimmedText)) {
      return { 
        valid: false, 
        sanitized: '', 
        error: 'Content contains unsafe elements' 
      };
    }

    // Validate HTML tags
    return this.validateHtmlTags(trimmedText);
  }

  /**
   * Проверяет наличие опасных паттернов в тексте
   */
  private static containsDangerousPatterns(text: string): boolean {
    const dangerousPatterns = [
      /<script\b/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi,
      /<form\b/gi
    ];

    return dangerousPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Проверяет HTML теги на соответствие разрешенным
   */
  private static validateHtmlTags(text: string): { valid: boolean; sanitized: string; error?: string } {
    // Process HTML tags
    const allowedTagsRegex = new RegExp(`</?(?:${this.ALLOWED_TAGS.join('|')})(?:\\s[^>]*)?>`, 'gi');
    const allTagsRegex = /<[^>]*>/g;
    
    // Find all tags
    const allTags = text.match(allTagsRegex) || [];
    const allowedTags = text.match(allowedTagsRegex) || [];
    
    // If there are disallowed tags - sanitize by removing all HTML
    if (allTags.length !== allowedTags.length) {
      return { 
        valid: false, 
        sanitized: text.replace(allTagsRegex, ''), 
        error: 'Content contains disallowed HTML tags. Only <b>, <i>, <u>, <br> are allowed.'
      };
    }

    // Check tag pairs (except <br>)
    const isValid = this.checkTagPairs(text);
    
    if (!isValid) {
      return { 
        valid: false, 
        sanitized: text.replace(allTagsRegex, ''), 
        error: 'HTML tags are not properly paired'
      };
    }

    return { valid: true, sanitized: text };
  }

  /**
   * Проверяет правильность парных тегов
   */
  private static checkTagPairs(text: string): boolean {
    const tagStack: string[] = [];
    const tagRegex = /<\/?([a-zA-Z]+)(?:\s[^>]*)?>?/g;
    let match;
    
    while ((match = tagRegex.exec(text)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      
      // <br> is self-closing
      if (tagName === 'br') continue;
      
      if (fullTag.startsWith('</')) {
        // Closing tag
        if (tagStack.length === 0 || tagStack.pop() !== tagName) {
          return false;
        }
      } else {
        // Opening tag
        tagStack.push(tagName);
      }
    }
    
    return tagStack.length === 0;
  }
}