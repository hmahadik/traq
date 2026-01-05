import { useState, useEffect, useCallback } from 'react';

interface KeyboardNavHandlers {
  onLeft?: () => void;
  onRight?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onSpace?: () => void;
  // Vim-style navigation
  onH?: () => void;
  onJ?: () => void;
  onK?: () => void;
  onL?: () => void;
  enabled?: boolean;
}

export function useKeyboardNav({
  onLeft,
  onRight,
  onUp,
  onDown,
  onEnter,
  onEscape,
  onSpace,
  onH,
  onJ,
  onK,
  onL,
  enabled = true,
}: KeyboardNavHandlers) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          onLeft?.();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onRight?.();
          break;
        case 'ArrowUp':
          event.preventDefault();
          onUp?.();
          break;
        case 'ArrowDown':
          event.preventDefault();
          onDown?.();
          break;
        case 'Enter':
          event.preventDefault();
          onEnter?.();
          break;
        case 'Escape':
          event.preventDefault();
          onEscape?.();
          break;
        case ' ':
          event.preventDefault();
          onSpace?.();
          break;
        case 'h':
          if (onH) {
            event.preventDefault();
            onH();
          } else if (onLeft) {
            event.preventDefault();
            onLeft();
          }
          break;
        case 'j':
          if (onJ) {
            event.preventDefault();
            onJ();
          } else if (onDown) {
            event.preventDefault();
            onDown();
          }
          break;
        case 'k':
          if (onK) {
            event.preventDefault();
            onK();
          } else if (onUp) {
            event.preventDefault();
            onUp();
          }
          break;
        case 'l':
          if (onL) {
            event.preventDefault();
            onL();
          } else if (onRight) {
            event.preventDefault();
            onRight();
          }
          break;
      }
    },
    [onLeft, onRight, onUp, onDown, onEnter, onEscape, onSpace, onH, onJ, onK, onL]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

// Hook for list navigation with selection
interface ListNavOptions<T> {
  items: T[];
  onSelect?: (item: T, index: number) => void;
  wrap?: boolean;
  enabled?: boolean;
}

export function useListNav<T>({
  items,
  onSelect,
  wrap = true,
  enabled = true,
}: ListNavOptions<T>) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const goToPrevious = useCallback(() => {
    setSelectedIndex((prev) => {
      const next = prev - 1;
      if (next < 0) {
        return wrap ? items.length - 1 : 0;
      }
      return next;
    });
  }, [items.length, wrap]);

  const goToNext = useCallback(() => {
    setSelectedIndex((prev) => {
      const next = prev + 1;
      if (next >= items.length) {
        return wrap ? 0 : items.length - 1;
      }
      return next;
    });
  }, [items.length, wrap]);

  const selectCurrent = useCallback(() => {
    if (items[selectedIndex]) {
      onSelect?.(items[selectedIndex], selectedIndex);
    }
  }, [items, selectedIndex, onSelect]);

  useKeyboardNav({
    onUp: goToPrevious,
    onDown: goToNext,
    onEnter: selectCurrent,
    enabled,
  });

  return {
    selectedIndex,
    setSelectedIndex,
    goToPrevious,
    goToNext,
    selectCurrent,
  };
}
