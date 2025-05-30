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
  maxLength = 200,
  expanded, 
  onToggle,
  className = "item-text"
}) => {
  
  const shouldTruncate = useMemo(() => {
    const tooLong = content.length > maxLength;
    
    const lineCount = content.split('\n').length;
    const tooManyLines = lineCount > 3;
    
    const hasLongWords = content.split(' ').some(word => word.length > 50);
    
    const estimatedVisualLines = Math.ceil(content.length / 60); // ~60 символов
    const tooManyEstimatedLines = estimatedVisualLines > 3;
    

    
    return tooLong || tooManyLines || hasLongWords || tooManyEstimatedLines;
  }, [content, maxLength]);

  const displayContent = useMemo(() => {
    if (expanded || !shouldTruncate) {
      return content;
    }
    
    if (content.length > maxLength) {
      const truncated = content.substring(0, maxLength);
      
      const lastPeriod = truncated.lastIndexOf('.');
      const lastExclamation = truncated.lastIndexOf('!');
      const lastQuestion = truncated.lastIndexOf('?');
      const bestSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
      
      if (bestSentenceEnd > maxLength * 0.7) {
        return content.substring(0, bestSentenceEnd + 1);
      }
      
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.8) {
        return content.substring(0, lastSpace) + '...';
      }
      
      return truncated + '...';
    }
    
    const lines = content.split('\n');
    if (lines.length > 3) {
      return lines.slice(0, 3).join('\n') + '\n...';
    }
    
    return content;
  }, [content, maxLength, expanded, shouldTruncate]);

  const textStyles: React.CSSProperties = useMemo(() => {
    const baseStyles = {
      contain: 'layout style' as const,
      wordBreak: 'break-word' as const,
      overflowWrap: 'break-word' as const,
      whiteSpace: 'pre-wrap' as const,
      lineHeight: '1.5',
    };

    if (expanded) {
      return baseStyles;
    }
    
    return {
      ...baseStyles,
      display: "-webkit-box" as const,
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical" as const,
      overflow: "hidden" as const,
    };
  }, [expanded]);


  return (
    <div className="optimized-text-container">
      <div
        className={`${className}${expanded ? " expanded" : ""}`}
        style={textStyles}
        dangerouslySetInnerHTML={{ 
          __html: displayContent.replace(/\n/g, "<br/>") 
        }}
      />
      
      {shouldTruncate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
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
  return (
    prevProps.content === nextProps.content &&
    prevProps.expanded === nextProps.expanded &&
    prevProps.maxLength === nextProps.maxLength
  );
});