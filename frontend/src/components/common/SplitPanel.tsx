// frontend/src/components/common/SplitPanel.tsx
import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SplitPanelProps {
  left: ReactNode;
  right: ReactNode;
  direction?: 'horizontal' | 'vertical';
  defaultSize?: number; // 0-100 percentage for left/top panel
  minSize?: number; // minimum percentage
  maxSize?: number; // maximum percentage
  storageKey?: string; // localStorage key for persistence
  className?: string;
}

export function SplitPanel({
  left,
  right,
  direction = 'horizontal',
  defaultSize = 60,
  minSize = 0,
  maxSize = 100,
  storageKey,
  className,
}: SplitPanelProps) {
  const [size, setSize] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return parseFloat(saved);
    }
    return defaultSize;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let newSize: number;

    if (direction === 'horizontal') {
      newSize = ((e.clientX - rect.left) / rect.width) * 100;
    } else {
      newSize = ((e.clientY - rect.top) / rect.height) * 100;
    }

    newSize = Math.max(minSize, Math.min(maxSize, newSize));
    setSize(newSize);

    if (storageKey) {
      localStorage.setItem(storageKey, newSize.toString());
    }
  }, [direction, minSize, maxSize, storageKey]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full',
        isHorizontal ? 'flex-row' : 'flex-col',
        className
      )}
    >
      <div
        style={{ [isHorizontal ? 'width' : 'height']: `${size}%` }}
        className="overflow-auto"
      >
        {left}
      </div>

      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'flex-shrink-0 bg-border hover:bg-primary/20 transition-colors',
          isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
        )}
      />

      <div
        style={{ [isHorizontal ? 'width' : 'height']: `${100 - size}%` }}
        className="overflow-auto"
      >
        {right}
      </div>
    </div>
  );
}
