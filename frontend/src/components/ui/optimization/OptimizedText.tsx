import React, { useMemo, useRef, useEffect, useCallback, useState } from "react";

interface OptimizedTextProps {
  content: string;
  maxLength?: number;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
  onResize?: (height: number) => void;
  itemId?: string;
  onShowMoreToggle?: () => void;
}

/*
  Компонент для отображения текста с возможностью сворачивания/разворачивания.
  Оптимизирован для производительности и стабильности при изменении высоты.
  Использует ResizeObserver для отслеживания изменений высоты контейнера.
*/
const OptimizedText: React.FC<OptimizedTextProps> = ({ 
  content, 
  maxLength = 250,
  expanded, 
  onToggle,
  className = "item-text",
  onResize,
  itemId = "unknown",
  onShowMoreToggle
}) => {
  // Refs for tracking container, height and state
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const previousHeightRef = useRef<number>(0);
  const [stabilized, setStabilized] = useState(false);
  const [opacity, setOpacity] = useState(0);
  
  // Fade in on initial render
  useEffect(() => {
    requestAnimationFrame(() => {
      setOpacity(1);
    });
  }, []);
  
  // Handle toggle button click
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
    
    // Additional height adjustment callback
    if (onShowMoreToggle) {
      requestAnimationFrame(() => onShowMoreToggle());
    }
  }, [onToggle, onShowMoreToggle]);
  
  // Configure ResizeObserver to track height changes
  useEffect(() => {
    resizeObserverRef.current = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry || !onResize || !stabilized) return;
      
      const newHeight = entry.contentRect.height;
      if (newHeight <= 0) return;
      
      // Only report significant height changes
      if (Math.abs(newHeight - previousHeightRef.current) > 3) {
        previousHeightRef.current = newHeight;
        onResize(newHeight);
        
        // Dispatch global event for other interested components
        if (itemId !== "unknown") {
          window.dispatchEvent(new CustomEvent("heightChanged", {
            bubbles: true,
            detail: { itemId, height: newHeight }
          }));
        }
      }
    });
    
    // Begin observing the container
    if (containerRef.current) {
      resizeObserverRef.current.observe(containerRef.current);
      
      // Mark component as ready for height tracking
      requestAnimationFrame(() => {
        setStabilized(true);
        
        // Initial measurement
        const initialHeight = containerRef.current?.offsetHeight || 0;
        previousHeightRef.current = initialHeight;
        
        if (onResize && initialHeight > 0) {
          onResize(initialHeight);
        }
      });
    }
    
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [onResize, itemId, stabilized]);
  
  // Determine if text needs truncation
  const shouldTruncate = useMemo(() => {
    const tooLong = content.length > maxLength;
    const lineCount = content.split('\n').length;
    const tooManyLines = lineCount > 3;
    
    return tooLong || tooManyLines;
  }, [content, maxLength]);
  
  // Get display text according to expanded state
  const displayContent = useMemo(() => {
    if (expanded || !shouldTruncate) {
      return content;
    }
    
    // Truncate by lines if more than 3
    const lines = content.split('\n');
    if (lines.length > 3) {
      return lines.slice(0, 3).join('\n') + '...';
    }
    
    // Otherwise truncate by length
    if (content.length > maxLength) {
      const truncated = content.substring(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      return (lastSpace > maxLength * 0.8 
        ? content.substring(0, lastSpace) 
        : truncated) + '...';
    }
    
    return content;
  }, [content, maxLength, expanded, shouldTruncate]);
  
  return (
    <div 
      className="optimized-text-container" 
      ref={containerRef} 
      data-item-id={itemId}
      style={{ 
        transition: stabilized ? 'opacity 0.2s ease-out, height 0.15s ease-out' : 'none',
        opacity: opacity,
        willChange: 'transform, opacity, height'
      }}
    >
      <div
        className={`${className}${expanded ? " expanded" : " truncated"}`}
        style={{
          ...(expanded ? {
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5',
          } : {
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            lineHeight: '1.5',
            marginBottom: '4px',
          })
        }}
        dangerouslySetInnerHTML={{ 
          __html: (expanded ? content : displayContent).replace(/\n/g, '<br/>') 
        }}
      />
      
      {/* Show more/less button */}
      {shouldTruncate && (
        <button
          type="button"
          onClick={handleToggle}
          className="show-more-button"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#1890ff',
            cursor: 'pointer',
            fontSize: '14px',
            margin: 0,
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