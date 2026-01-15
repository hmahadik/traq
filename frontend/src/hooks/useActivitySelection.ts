/**
 * Activity Selection Hook
 *
 * Manages selection state for ActivityBlocks (window focus events).
 * Supports:
 * - Single click selection
 * - Shift+click range selection (list view)
 * - Ctrl/Cmd+click toggle selection
 * - Lasso/drag selection (grid view)
 */

import { useState, useCallback, useRef } from 'react';

export interface SelectionState {
  selectedIds: Set<number>;
  lastClickedId: number | null;
}

export interface LassoState {
  isSelecting: boolean;
  startPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
}

export interface UseActivitySelectionReturn {
  // Selection state
  selectedIds: Set<number>;
  selectedCount: number;
  isSelected: (id: number) => boolean;

  // Selection actions
  select: (id: number) => void;
  toggle: (id: number) => void;
  selectRange: (fromId: number, toId: number, orderedIds: number[]) => void;
  selectAll: (ids: number[]) => void;
  clearSelection: () => void;

  // Click handler (handles shift/ctrl modifiers)
  handleClick: (id: number, event: React.MouseEvent, orderedIds?: number[]) => void;

  // Lasso selection (grid view)
  lassoState: LassoState;
  startLasso: (x: number, y: number) => void;
  updateLasso: (x: number, y: number) => void;
  endLasso: (intersectingIds: number[]) => void;
  cancelLasso: () => void;

  // Lasso rectangle for rendering
  lassoRect: { x: number; y: number; width: number; height: number } | null;

  // Lasso preview IDs (updated during drag for real-time feedback)
  lassoPreviewIds: Set<number>;
  setLassoPreviewIds: (ids: number[]) => void;
}

export function useActivitySelection(): UseActivitySelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<number | null>(null);
  const [lassoState, setLassoState] = useState<LassoState>({
    isSelecting: false,
    startPoint: null,
    currentPoint: null,
  });
  const [lassoPreviewIds, setLassoPreviewIdsState] = useState<Set<number>>(new Set());

  // Track if we're adding to selection during lasso
  const lassoAdditive = useRef(false);

  // Set lasso preview IDs (called during drag for real-time feedback)
  const setLassoPreviewIds = useCallback((ids: number[]) => {
    setLassoPreviewIdsState(new Set(ids));
  }, []);

  // Check if an ID is selected
  const isSelected = useCallback(
    (id: number) => selectedIds.has(id),
    [selectedIds]
  );

  // Select a single ID (replaces selection)
  const select = useCallback((id: number) => {
    setSelectedIds(new Set([id]));
    setLastClickedId(id);
  }, []);

  // Toggle a single ID in selection
  const toggle = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastClickedId(id);
  }, []);

  // Select a range of IDs based on ordered list
  const selectRange = useCallback(
    (fromId: number, toId: number, orderedIds: number[]) => {
      const fromIndex = orderedIds.indexOf(fromId);
      const toIndex = orderedIds.indexOf(toId);

      if (fromIndex === -1 || toIndex === -1) return;

      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const rangeIds = orderedIds.slice(start, end + 1);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
      setLastClickedId(toId);
    },
    []
  );

  // Select all provided IDs
  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  // Clear all selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedId(null);
  }, []);

  // Handle click with modifier keys
  const handleClick = useCallback(
    (id: number, event: React.MouseEvent, orderedIds?: number[]) => {
      event.stopPropagation();

      const isShift = event.shiftKey;
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      if (isShift && lastClickedId !== null && orderedIds) {
        // Shift+click: select range
        selectRange(lastClickedId, id, orderedIds);
      } else if (isCtrlOrMeta) {
        // Ctrl/Cmd+click: toggle in selection
        toggle(id);
      } else {
        // Normal click: select only this one
        select(id);
      }
    },
    [lastClickedId, select, toggle, selectRange]
  );

  // Start lasso selection
  const startLasso = useCallback((x: number, y: number) => {
    setLassoState({
      isSelecting: true,
      startPoint: { x, y },
      currentPoint: { x, y },
    });
  }, []);

  // Update lasso position during drag
  const updateLasso = useCallback((x: number, y: number) => {
    setLassoState((prev) => {
      if (!prev.isSelecting) return prev;
      return {
        ...prev,
        currentPoint: { x, y },
      };
    });
  }, []);

  // End lasso selection with intersecting IDs
  const endLasso = useCallback(
    (intersectingIds: number[]) => {
      if (lassoAdditive.current) {
        // Add to existing selection
        setSelectedIds((prev) => {
          const next = new Set(prev);
          intersectingIds.forEach((id) => next.add(id));
          return next;
        });
      } else {
        // Replace selection
        setSelectedIds(new Set(intersectingIds));
      }

      setLassoState({
        isSelecting: false,
        startPoint: null,
        currentPoint: null,
      });
      // Clear preview when lasso ends
      setLassoPreviewIdsState(new Set());
    },
    []
  );

  // Cancel lasso without selecting
  const cancelLasso = useCallback(() => {
    setLassoState({
      isSelecting: false,
      startPoint: null,
      currentPoint: null,
    });
    // Clear preview when lasso cancelled
    setLassoPreviewIdsState(new Set());
  }, []);

  // Calculate lasso rectangle for rendering
  const lassoRect =
    lassoState.isSelecting && lassoState.startPoint && lassoState.currentPoint
      ? {
          x: Math.min(lassoState.startPoint.x, lassoState.currentPoint.x),
          y: Math.min(lassoState.startPoint.y, lassoState.currentPoint.y),
          width: Math.abs(lassoState.currentPoint.x - lassoState.startPoint.x),
          height: Math.abs(lassoState.currentPoint.y - lassoState.startPoint.y),
        }
      : null;

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    select,
    toggle,
    selectRange,
    selectAll,
    clearSelection,
    handleClick,
    lassoState,
    startLasso,
    updateLasso,
    endLasso,
    cancelLasso,
    lassoRect,
    lassoPreviewIds,
    setLassoPreviewIds,
  };
}
