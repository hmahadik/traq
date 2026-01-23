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
  rightCollapsed?: boolean; // When true, minimize right panel to collapsedSize
  collapsedSize?: number; // Size (percentage) when collapsed, default 5
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
  rightCollapsed = false,
  collapsedSize = 5,
}: SplitPanelProps) {
  const [size, setSize] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return parseFloat(saved);
    }
    return defaultSize;
  });

  // Effective size - use collapsed size when right panel is collapsed
  const effectiveSize = rightCollapsed ? (100 - collapsedSize) : size;

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
        style={{ [isHorizontal ? 'width' : 'height']: `${effectiveSize}%` }}
        className={cn('overflow-auto', rightCollapsed && 'transition-all duration-200')}
      >
        {left}
      </div>

      <div
        onMouseDown={rightCollapsed ? undefined : handleMouseDown}
        className={cn(
          'flex-shrink-0 bg-border transition-colors',
          isHorizontal ? 'w-1' : 'h-1',
          rightCollapsed ? 'cursor-default' : (isHorizontal ? 'cursor-col-resize hover:bg-primary/20' : 'cursor-row-resize hover:bg-primary/20')
        )}
      />

      <div
        style={{ [isHorizontal ? 'width' : 'height']: `${100 - effectiveSize}%` }}
        className={cn('overflow-auto', rightCollapsed && 'transition-all duration-200')}
      >
        {right}
      </div>
    </div>
  );
}
