import { useState, useCallback, useEffect } from 'react';

interface UseListNavOptions {
  itemCount: number;
  initialIndex?: number;
  onSelect?: (index: number) => void;
  wrap?: boolean;
}

interface UseListNavReturn {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  goToNext: () => void;
  goToPrevious: () => void;
  goToFirst: () => void;
  goToLast: () => void;
}

export function useListNav({
  itemCount,
  initialIndex = -1,
  onSelect,
  wrap = false,
}: UseListNavOptions): UseListNavReturn {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  const goToNext = useCallback(() => {
    setSelectedIndex((current) => {
      if (itemCount === 0) return -1;
      if (current === -1) return 0;
      if (current >= itemCount - 1) {
        return wrap ? 0 : current;
      }
      return current + 1;
    });
  }, [itemCount, wrap]);

  const goToPrevious = useCallback(() => {
    setSelectedIndex((current) => {
      if (itemCount === 0) return -1;
      if (current === -1) return itemCount - 1;
      if (current <= 0) {
        return wrap ? itemCount - 1 : current;
      }
      return current - 1;
    });
  }, [itemCount, wrap]);

  const goToFirst = useCallback(() => {
    if (itemCount > 0) {
      setSelectedIndex(0);
    }
  }, [itemCount]);

  const goToLast = useCallback(() => {
    if (itemCount > 0) {
      setSelectedIndex(itemCount - 1);
    }
  }, [itemCount]);

  // Reset selection when item count changes and selection is out of bounds
  useEffect(() => {
    if (selectedIndex >= itemCount) {
      setSelectedIndex(itemCount > 0 ? itemCount - 1 : -1);
    }
  }, [itemCount, selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'j':
          event.preventDefault();
          goToNext();
          break;
        case 'ArrowUp':
        case 'k':
          event.preventDefault();
          goToPrevious();
          break;
        case 'Home':
        case 'g':
          if (event.key === 'g' && event.shiftKey) return; // gg for vim
          event.preventDefault();
          goToFirst();
          break;
        case 'End':
        case 'G':
          event.preventDefault();
          goToLast();
          break;
        case 'Enter':
          event.preventDefault();
          if (selectedIndex >= 0 && onSelect) {
            onSelect(selectedIndex);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrevious, goToFirst, goToLast, selectedIndex, onSelect]);

  return {
    selectedIndex,
    setSelectedIndex,
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
  };
}
