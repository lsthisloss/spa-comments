import React, { useMemo } from "react";

interface OptimizedTextProps {
  content: string;
  maxLength?: number;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

const OptimizedText: React.FC<OptimizedTextProps> = ({ 
  content, 
  maxLength = 250,
  expanded, 
  onToggle,
  className = "item-text"
}) => {
  
  // ДЕТАЛЬНЫЙ ДЕБАГ
  
  const shouldTruncate = useMemo(() => {
    const tooLong = content.length > maxLength;
    const lineCount = content.split('\n').length;
    const tooManyLines = lineCount > 3;
    
    const result = tooLong || tooManyLines;
    
    return result;
  }, [content, maxLength]);

  const displayContent = useMemo(() => {
    if (expanded || !shouldTruncate) {
      return content;
    }
    
    // ФИКСИРОВАННОЕ УСЕЧЕНИЕ - БЕРЕМ ПЕРВЫЕ 3 СТРОКИ ИЛИ maxLength СИМВОЛОВ
    const lines = content.split('\n');
    
    if (lines.length > 3) {
      const truncatedByLines = lines.slice(0, 3).join('\n');
      return truncatedByLines;
    }
    
    if (content.length > maxLength) {
      const truncated = content.substring(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      const result = lastSpace > maxLength * 0.8 
        ? content.substring(0, lastSpace) 
        : truncated;
      return result;
    }
    
    return content;
  }, [content, maxLength, expanded, shouldTruncate]);


  return (
    <div className="optimized-text-container">
      {/* ЕСЛИ НЕ РАЗВЕРНУТО И НУЖНО УСЕЧЬ - ИСПОЛЬЗУЕМ CSS CLAMP */}
      {!expanded && shouldTruncate ? (
        <div
          className={`${className} truncated`}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
          }}
          dangerouslySetInnerHTML={{ 
            __html: content.replace(/\n/g, "<br/>") 
          }}
        />
      ) : (
        <div
          className={`${className}${expanded ? " expanded" : ""}`}
          style={{
            contain: 'layout style',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5',
          }}
          dangerouslySetInnerHTML={{ 
            __html: displayContent.replace(/\n/g, "<br/>") 
          }}
        />
      )}
      
      {/* КНОПКА ПОКАЗАТЬ БОЛЬШЕ/МЕНЬШЕ */}
      {shouldTruncate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            console.log('[OptimizedText] Toggle button clicked, current expanded:', expanded);
            onToggle();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#1890ff',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '4px 0 0 0',
            margin: 0,
            textDecoration: 'none',
            display: 'block',
            fontFamily: 'inherit',
            outline: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};

export default React.memo(OptimizedText, (prevProps, nextProps) => {
  const shouldUpdate = (
    prevProps.content !== nextProps.content ||
    prevProps.expanded !== nextProps.expanded ||
    prevProps.maxLength !== nextProps.maxLength
  );
  
  return !shouldUpdate;
});