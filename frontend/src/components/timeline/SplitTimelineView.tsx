import { useEffect, useRef } from 'react';
import type { TimelineGridData, ActivityBlock } from '@/types/timeline';
import type { TimelineFilters } from './FilterControls';
import { TimelineGridView } from './TimelineGridView';
import { TimelineListView } from './TimelineListView';
import type { ZoomLevel } from './ZoomControls';

interface SplitTimelineViewProps {
  data: TimelineGridData;
  filters: TimelineFilters;
  hourHeight: ZoomLevel;
  onSessionClick?: (sessionId: number) => void;
  // Selection props
  selectedActivityIds?: Set<number>;
  onActivitySelect?: (id: number, event: React.MouseEvent) => void;
  onActivityDoubleClick?: (block: ActivityBlock) => void;
  // Lasso selection props (for grid view)
  lassoRect?: { x: number; y: number; width: number; height: number } | null;
  onLassoStart?: (x: number, y: number) => void;
  onLassoMove?: (x: number, y: number) => void;
  onLassoEnd?: (intersectingIds: number[]) => void;
  // List selection (shift+click needs ordered IDs)
  onListActivitySelect?: (id: number, event: React.MouseEvent, orderedIds: number[]) => void;
}

// Grid header height (matches TimelineGridView HEADER_HEIGHT_PX)
const GRID_HEADER_HEIGHT = 44;

// Debounce time to prevent feedback loops (ms)
const SYNC_DEBOUNCE_MS = 50;

export function SplitTimelineView({
  data,
  filters,
  hourHeight,
  onSessionClick,
  selectedActivityIds,
  onActivitySelect,
  onActivityDoubleClick,
  lassoRect,
  onLassoStart,
  onLassoMove,
  onLassoEnd,
  onListActivitySelect,
}: SplitTimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Track which side is the "source" of scrolling to prevent feedback loops
  const scrollSourceRef = useRef<'grid' | 'list' | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Find scroll containers within Grid and List components
    // Grid uses Radix ScrollArea - need to find [data-radix-scroll-area-viewport]
    // List uses plain div with data-scroll-container="list"
    const gridScrollArea = containerRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    const listScrollContainer = containerRef.current.querySelector('[data-scroll-container="list"]') as HTMLElement;

    if (!gridScrollArea || !listScrollContainer) return;

    // Helper to get hour sections with their positions relative to scroll container
    const getHourSectionsInfo = () => {
      const sections = listScrollContainer.querySelectorAll('[data-hour]');
      const scrollContainerRect = listScrollContainer.getBoundingClientRect();
      const scrollTop = listScrollContainer.scrollTop;

      return Array.from(sections).map((el) => {
        const element = el as HTMLElement;
        const rect = element.getBoundingClientRect();
        // Calculate position relative to scroll container's content (not viewport)
        const offsetTop = rect.top - scrollContainerRect.top + scrollTop;
        return {
          hour: parseInt(element.dataset.hour || '0', 10),
          offsetTop,
          height: element.clientHeight,
        };
      });
    };

    // Clear the scroll lock after debounce period
    const clearScrollLock = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollSourceRef.current = null;
      }, SYNC_DEBOUNCE_MS);
    };

    // Smooth proportional sync: Grid → List
    const handleGridScroll = () => {
      // If list is the source, ignore grid scroll events (they're from our sync)
      if (scrollSourceRef.current === 'list') return;

      // Mark grid as the source
      scrollSourceRef.current = 'grid';

      const scrollTop = gridScrollArea.scrollTop;
      const viewportHeight = gridScrollArea.clientHeight;

      // Calculate the center of the visible viewport in grid coordinates
      const centerScrollPosition = scrollTop + (viewportHeight / 2);

      // Calculate exact position in hours at the CENTER of viewport
      const exactHourPosition = Math.max(0, (centerScrollPosition - GRID_HEADER_HEIGHT) / hourHeight);
      const hourAtCenter = Math.floor(exactHourPosition);
      const fractionInHour = exactHourPosition - hourAtCenter;

      const sectionsInfo = getHourSectionsInfo();
      if (sectionsInfo.length === 0) {
        clearScrollLock();
        return;
      }

      const listViewportHeight = listScrollContainer.clientHeight;

      // Find the section for this exact hour
      const exactSection = sectionsInfo.find(s => s.hour === hourAtCenter);

      if (exactSection) {
        // We have data for this hour - calculate position then center it in list viewport
        const positionInSection = exactSection.offsetTop + (fractionInHour * exactSection.height);
        const targetScrollTop = positionInSection - (listViewportHeight / 2);
        listScrollContainer.scrollTop = Math.max(0, targetScrollTop);
      } else {
        // No data for this hour - find the TEMPORALLY closest section
        let closestSection = sectionsInfo[0];
        let minDistance = Math.abs(sectionsInfo[0].hour - hourAtCenter);

        for (const section of sectionsInfo) {
          const distance = Math.abs(section.hour - hourAtCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closestSection = section;
          }
        }

        // Determine scroll position based on where hourAtCenter falls relative to closestSection
        let targetScrollTop: number;

        if (hourAtCenter > sectionsInfo[sectionsInfo.length - 1].hour) {
          // Past all data - show the end of the last section
          targetScrollTop = closestSection.offsetTop + closestSection.height - listViewportHeight;
        } else if (hourAtCenter < sectionsInfo[0].hour) {
          // Before all data - show the start of the first section
          targetScrollTop = closestSection.offsetTop - (listViewportHeight / 2);
        } else {
          // In a gap - center the closest section
          targetScrollTop = closestSection.offsetTop - (listViewportHeight / 2);
        }

        listScrollContainer.scrollTop = Math.max(0, targetScrollTop);
      }

      clearScrollLock();
    };

    // Smooth proportional sync: List → Grid
    const handleListScroll = () => {
      // If grid is the source, ignore list scroll events (they're from our sync)
      if (scrollSourceRef.current === 'grid') return;

      // Mark list as the source
      scrollSourceRef.current = 'list';

      const scrollTop = listScrollContainer.scrollTop;
      const listViewportHeight = listScrollContainer.clientHeight;
      const gridViewportHeight = gridScrollArea.clientHeight;

      // Calculate the center position of the list viewport
      const centerScrollPosition = scrollTop + (listViewportHeight / 2);

      const sectionsInfo = getHourSectionsInfo();

      if (sectionsInfo.length === 0) {
        clearScrollLock();
        return;
      }

      // Find which section contains the CENTER of the viewport
      let currentSection = sectionsInfo[0];

      for (let i = 0; i < sectionsInfo.length; i++) {
        if (sectionsInfo[i].offsetTop <= centerScrollPosition) {
          currentSection = sectionsInfo[i];
        } else {
          break;
        }
      }

      // Calculate fraction through the current section (relative to center)
      const positionInSection = centerScrollPosition - currentSection.offsetTop;
      const fractionInSection = Math.min(1, Math.max(0, positionInSection / currentSection.height));

      // Calculate grid position for this hour+fraction, then center it in grid viewport
      const gridHourPosition = GRID_HEADER_HEIGHT + (currentSection.hour * hourHeight) + (fractionInSection * hourHeight);
      const gridScrollTarget = gridHourPosition - (gridViewportHeight / 2);
      gridScrollArea.scrollTop = Math.max(0, gridScrollTarget);

      clearScrollLock();
    };

    gridScrollArea.addEventListener('scroll', handleGridScroll);
    listScrollContainer.addEventListener('scroll', handleListScroll);

    return () => {
      gridScrollArea.removeEventListener('scroll', handleGridScroll);
      listScrollContainer.removeEventListener('scroll', handleListScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [data, hourHeight]); // Re-sync when data or zoom changes

  return (
    <div ref={containerRef} className="flex gap-3 flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TimelineGridView
          data={data}
          filters={filters}
          hourHeight={hourHeight}
          onSessionClick={onSessionClick}
          selectedActivityIds={selectedActivityIds}
          onActivitySelect={onActivitySelect}
          onActivityDoubleClick={onActivityDoubleClick}
          lassoRect={lassoRect}
          onLassoStart={onLassoStart}
          onLassoMove={onLassoMove}
          onLassoEnd={onLassoEnd}
        />
      </div>
      <div className="w-px bg-border" />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TimelineListView
          data={data}
          filters={filters}
          onSessionClick={onSessionClick}
          selectedActivityIds={selectedActivityIds}
          onActivitySelect={onListActivitySelect}
          onActivityDoubleClick={onActivityDoubleClick}
        />
      </div>
    </div>
  );
}
