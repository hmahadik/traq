// frontend/src/components/timeline/SelectionContext.tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { EventKey } from '@/utils/eventKeys';

interface SelectionState {
  selectedKeys: Set<EventKey>;
  hoveredKey: EventKey | null;
}

interface SelectionContextValue extends SelectionState {
  select: (key: EventKey) => void;
  toggle: (key: EventKey) => void;
  selectRange: (keys: EventKey[]) => void;
  selectMany: (keys: EventKey[]) => void;
  deselect: (key: EventKey) => void;
  clear: () => void;
  isSelected: (key: EventKey) => boolean;
  setHovered: (key: EventKey | null) => void;
  scrollToKey: (key: EventKey) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

interface SelectionProviderProps {
  children: ReactNode;
  onScrollTo?: (key: EventKey) => void;
}

export function SelectionProvider({ children, onScrollTo }: SelectionProviderProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<EventKey>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<EventKey | null>(null);

  const select = useCallback((key: EventKey) => {
    setSelectedKeys(new Set([key]));
  }, []);

  const toggle = useCallback((key: EventKey) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectMany = useCallback((keys: EventKey[]) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.add(k));
      return next;
    });
  }, []);

  const selectRange = useCallback((keys: EventKey[]) => {
    setSelectedKeys(new Set(keys));
  }, []);

  const deselect = useCallback((key: EventKey) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const isSelected = useCallback((key: EventKey) => {
    return selectedKeys.has(key);
  }, [selectedKeys]);

  const setHovered = useCallback((key: EventKey | null) => {
    setHoveredKey(key);
  }, []);

  const scrollToKey = useCallback((key: EventKey) => {
    onScrollTo?.(key);
  }, [onScrollTo]);

  return (
    <SelectionContext.Provider value={{
      selectedKeys,
      hoveredKey,
      select,
      toggle,
      selectRange,
      selectMany,
      deselect,
      clear,
      isSelected,
      setHovered,
      scrollToKey,
    }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}

// Optional hook that doesn't throw if context is missing
export function useSelectionOptional() {
  return useContext(SelectionContext);
}
