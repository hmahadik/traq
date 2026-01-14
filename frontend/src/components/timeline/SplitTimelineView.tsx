import { useEffect, useRef } from 'react';
import type { TimelineGridData } from '@/types/timeline';
import type { TimelineFilters } from './FilterControls';
import { TimelineGridView } from './TimelineGridView';
import { TimelineListView } from './TimelineListView';
import type { ZoomLevel } from './ZoomControls';

interface SplitTimelineViewProps {
  data: TimelineGridData;
  filters: TimelineFilters;
  hourHeight: ZoomLevel;
  onSessionClick?: (sessionId: number) => void;
}

// Grid header height (matches TimelineGridView HEADER_HEIGHT_PX)
const GRID_HEADER_HEIGHT = 44;

// Minimum scroll delta to trigger sync (prevents feedback loops)
const SYNC_THRESHOLD = 5;

export function SplitTimelineView({ data, filters, hourHeight, onSessionClick }: SplitTimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const lastGridScrollRef = useRef(0);
  const lastListScrollRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Find scroll containers within Grid and List components
    // Grid uses Radix ScrollArea - need to find [data-radix-scroll-area-viewport]
    // List uses plain div with data-scroll-container="list"
    const gridScrollArea = containerRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    const listScrollContainer = containerRef.current.querySelector('[data-scroll-container="list"]') as HTMLElement;

    if (!gridScrollArea || !listScrollContainer) return;

    // Helper to get hour sections with their positions
    const getHourSectionsInfo = () => {
      const sections = listScrollContainer.querySelectorAll('[data-hour]');
      return Array.from(sections).map((el) => {
        const element = el as HTMLElement;
        return {
          hour: parseInt(element.dataset.hour || '0', 10),
          offsetTop: element.offsetTop,
          height: element.clientHeight,
        };
      });
    };

    // Smooth proportional sync: Grid → List
    const handleGridScroll = () => {
      if (syncingRef.current) return;

      const scrollTop = gridScrollArea.scrollTop;

      // Skip if scroll delta is too small (prevents feedback loops)
      if (Math.abs(scrollTop - lastGridScrollRef.current) < SYNC_THRESHOLD) return;
      lastGridScrollRef.current = scrollTop;

      syncingRef.current = true;

      // Calculate exact position in hours (e.g., 10.5 = halfway through hour 10)
      const exactHourPosition = Math.max(0, (scrollTop - GRID_HEADER_HEIGHT) / hourHeight);
      const hourAtTop = Math.floor(exactHourPosition);
      const fractionInHour = exactHourPosition - hourAtTop;

      const sectionsInfo = getHourSectionsInfo();
      if (sectionsInfo.length === 0) {
        requestAnimationFrame(() => { syncingRef.current = false; });
        return;
      }

      // Find the section for this exact hour
      const exactSection = sectionsInfo.find(s => s.hour === hourAtTop);

      if (exactSection) {
        // We have data for this hour - do smooth proportional scrolling
        const targetScrollTop = exactSection.offsetTop + (fractionInHour * exactSection.height);
        listScrollContainer.scrollTop = targetScrollTop;
      } else {
        // No data for this hour - find nearest section and snap to it
        let closestSection = sectionsInfo[0];
        for (const section of sectionsInfo) {
          if (section.hour <= hourAtTop) {
            closestSection = section;
          } else {
            break;
          }
        }
        // If hourAtTop is before all sections, use the first one
        if (hourAtTop < sectionsInfo[0].hour) {
          closestSection = sectionsInfo[0];
        }
        listScrollContainer.scrollTop = closestSection.offsetTop;
      }

      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    };

    // Smooth proportional sync: List → Grid
    const handleListScroll = () => {
      if (syncingRef.current) return;

      const scrollTop = listScrollContainer.scrollTop;

      // Skip if scroll delta is too small (prevents feedback loops)
      if (Math.abs(scrollTop - lastListScrollRef.current) < SYNC_THRESHOLD) return;
      lastListScrollRef.current = scrollTop;

      syncingRef.current = true;
      const sectionsInfo = getHourSectionsInfo();

      if (sectionsInfo.length === 0) {
        syncingRef.current = false;
        return;
      }

      // Find which section contains the current scroll position
      let currentSection = sectionsInfo[0];
      let sectionIndex = 0;

      for (let i = 0; i < sectionsInfo.length; i++) {
        if (sectionsInfo[i].offsetTop <= scrollTop) {
          currentSection = sectionsInfo[i];
          sectionIndex = i;
        } else {
          break;
        }
      }

      // Calculate fraction through the current section
      const positionInSection = scrollTop - currentSection.offsetTop;
      const fractionInSection = Math.min(1, Math.max(0, positionInSection / currentSection.height));

      // Calculate grid scroll position with interpolation
      const gridScrollTarget = GRID_HEADER_HEIGHT + (currentSection.hour * hourHeight) + (fractionInSection * hourHeight);
      gridScrollArea.scrollTop = gridScrollTarget;

      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    };

    gridScrollArea.addEventListener('scroll', handleGridScroll);
    listScrollContainer.addEventListener('scroll', handleListScroll);

    return () => {
      gridScrollArea.removeEventListener('scroll', handleGridScroll);
      listScrollContainer.removeEventListener('scroll', handleListScroll);
    };
  }, [data, hourHeight]); // Re-sync when data or zoom changes

  return (
    <div ref={containerRef} className="flex gap-3 flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TimelineGridView data={data} filters={filters} hourHeight={hourHeight} onSessionClick={onSessionClick} />
      </div>
      <div className="w-px bg-border" />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TimelineListView data={data} filters={filters} onSessionClick={onSessionClick} />
      </div>
    </div>
  );
}
