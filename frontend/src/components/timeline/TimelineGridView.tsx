import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { TimelineGridData, GRID_CONSTANTS, ActivityBlock as ActivityBlockType, SessionSummaryWithPosition } from '@/types/timeline';
import { HourColumn } from './HourColumn';
import { AISummaryColumn } from './AISummaryColumn';
import { ScreenshotColumn } from './ScreenshotColumn';
import { AppColumn } from './AppColumn';
import { GitColumn } from './GitColumn';
import { ShellColumn } from './ShellColumn';
import { FilesColumn } from './FilesColumn';
import { BrowserColumn } from './BrowserColumn';
import { AFKColumn } from './AFKColumn';
import { ProjectsColumn } from './ProjectsColumn';
import { TimelineFilters } from './FilterControls';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ImageGallery } from '@/components/common/ImageGallery';
import { useScreenshotsForDate, useEntriesForDate } from '@/api/hooks';
import type { Screenshot } from '@/types';
import { useActivitySelection } from './useActivitySelection';
import { AssignmentToolbar } from './AssignmentToolbar';

// Event key format: "eventType:id" e.g. "activity:123", "browser:456"
type EventKey = string;

interface TimelineGridViewProps {
  data: TimelineGridData;
  filters?: TimelineFilters;
  hourHeight?: number; // Dynamic hour height for zoom (default: GRID_CONSTANTS.HOUR_HEIGHT_PX)
  onSessionClick?: (sessionId: number) => void; // Callback when session is clicked
  // Selection props
  selectedActivityIds?: Set<number>;
  onActivitySelect?: (id: number, event: React.MouseEvent) => void;
  onActivityDoubleClick?: (block: ActivityBlockType) => void;
  // Lasso selection props
  lassoRect?: { x: number; y: number; width: number; height: number } | null;
  onLassoStart?: (x: number, y: number) => void;
  onLassoMove?: (x: number, y: number) => void;
  onLassoEnd?: (intersectingIds: number[]) => void;
  // Multi-type event selection via lasso (new)
  selectedEventKeys?: Set<EventKey>;
  onLassoEndWithKeys?: (keys: EventKey[]) => void;
  // Lasso preview (real-time highlighting during drag)
  lassoPreviewIds?: Set<number>;
  onLassoPreview?: (ids: number[]) => void;
  lassoPreviewKeys?: Set<EventKey>;
  onLassoPreviewKeys?: (keys: EventKey[]) => void;
}

// Header height for column headers (matches the header in HourColumn/AppColumn)
const HEADER_HEIGHT_PX = 44;

export const TimelineGridView: React.FC<TimelineGridViewProps> = ({
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
  selectedEventKeys,
  onLassoEndWithKeys,
  lassoPreviewIds,
  onLassoPreview,
  lassoPreviewKeys,
  onLassoPreviewKeys,
}) => {
  const { hourlyGrid, sessionSummaries, topApps } = data;
  const gridContainerRef = React.useRef<HTMLDivElement>(null);
  const lassoStartRef = React.useRef<{ x: number; y: number } | null>(null);

  // Use provided hourHeight or fall back to default
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;

  // Default to showing all if no filters provided
  const activeFilters: TimelineFilters = filters || {
    showGit: true,
    showShell: true,
    showFiles: true,
    showBrowser: true,
    showScreenshots: true,
  };

  // Fetch all screenshots for this date
  const { data: allScreenshots } = useScreenshotsForDate(data.date);

  // Fetch entries for the Entries lane
  const { data: entries } = useEntriesForDate(data.date);

  // Activity selection for project assignment
  const {
    selectedActivities,
    toggleSelection,
    clearSelection,
  } = useActivitySelection();

  // Create a Set for efficient lookup
  const selectedEntryIds = new Set(
    selectedActivities.map(a => `${a.eventType}-${a.eventId}`)
  );

  // ImageGallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryScreenshots, setGalleryScreenshots] = useState<Screenshot[]>([]);

  // Check if viewing today for the "now" indicator
  const isToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return data.date === today;
  }, [data.date]);

  // Current time state for "now" line (updates every minute)
  const [nowPosition, setNowPosition] = useState<number | null>(null);

  useEffect(() => {
    if (!isToday) {
      setNowPosition(null);
      return;
    }

    const updateNowPosition = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      // Position = header + (hour * hourHeight) + (minute fraction of hour)
      const position = HEADER_HEIGHT_PX + (currentHour * effectiveHourHeight) +
        (currentMinute / 60 * effectiveHourHeight);
      setNowPosition(position);
    };

    updateNowPosition();
    const interval = setInterval(updateNowPosition, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isToday, effectiveHourHeight]);

  // Always show full 24-hour day (12 AM to 11 PM)
  const activeHours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i); // 0-23 (12 AM to 11 PM)
  }, []);

  // Prepare app columns data - limit to MAX_APP_COLUMNS to reduce scrolling
  const appColumns = useMemo(() => {
    if (!topApps) return [];
    return topApps.slice(0, GRID_CONSTANTS.MAX_APP_COLUMNS).map((app) => {
      // Collect all activity blocks for this app across all hours
      const activityBlocks: any[] = [];
      Object.entries(hourlyGrid).forEach(([, appActivities]) => {
        if (appActivities[app.appName]) {
          activityBlocks.push(...appActivities[app.appName]);
        }
      });

      return {
        appName: app.appName,
        category: app.category,
        totalDuration: app.duration,
        activityBlocks,
      };
    });
  }, [topApps, hourlyGrid]);

  // Handle activity block click - filter screenshots by time range and open gallery
  const handleActivityBlockClick = useCallback((block: ActivityBlockType) => {
    if (!allScreenshots || allScreenshots.length === 0) {
      return;
    }

    // Calculate end time from start time and duration
    const startTime = block.startTime;
    const endTime = startTime + block.durationSeconds;

    // Filter screenshots within this time range
    // The API returns ScreenshotDisplay | Screenshot union, but both have id/timestamp
    const filtered = allScreenshots.filter((s: any) =>
      s.timestamp >= startTime && s.timestamp <= endTime
    ) as Screenshot[];

    if (filtered.length > 0) {
      setGalleryScreenshots(filtered);
      setGalleryOpen(true);
    }
  }, [allScreenshots]);

  // Handle session click - call parent callback to open drawer
  const handleSessionClick = useCallback((session: SessionSummaryWithPosition) => {
    onSessionClick?.(session.id);
  }, [onSessionClick]);

  // Collect all activity blocks for lasso intersection detection
  const allActivityBlocks = useMemo(() => {
    const blocks: ActivityBlockType[] = [];
    Object.values(hourlyGrid).forEach((appActivities) => {
      Object.values(appActivities).forEach((activities) => {
        blocks.push(...activities);
      });
    });
    return blocks;
  }, [hourlyGrid]);

  // Find all events that intersect with a rectangle (returns EventKeys)
  const findIntersectingEvents = useCallback(
    (rect: { x: number; y: number; width: number; height: number }): EventKey[] => {
      if (!gridContainerRef.current) return [];

      const intersectingKeys: EventKey[] = [];
      const containerRect = gridContainerRef.current.getBoundingClientRect();

      // Helper to check if element intersects with rect
      const checkIntersection = (element: Element): boolean => {
        const elementRect = element.getBoundingClientRect();
        const elemX = elementRect.left - containerRect.left;
        const elemY = elementRect.top - containerRect.top;
        const elemWidth = elementRect.width;
        const elemHeight = elementRect.height;

        return (
          rect.x < elemX + elemWidth &&
          rect.x + rect.width > elemX &&
          rect.y < elemY + elemHeight &&
          rect.y + rect.height > elemY
        );
      };

      // Find elements with single event key (activities, files, afk)
      const singleKeyElements = gridContainerRef.current.querySelectorAll('[data-event-key]');
      singleKeyElements.forEach((element) => {
        const eventKey = element.getAttribute('data-event-key');
        if (eventKey && checkIntersection(element)) {
          intersectingKeys.push(eventKey);
        }
      });

      // Find elements with multiple event keys (grouped git, shell, browser)
      const multiKeyElements = gridContainerRef.current.querySelectorAll('[data-event-keys]');
      multiKeyElements.forEach((element) => {
        const eventKeysJson = element.getAttribute('data-event-keys');
        if (eventKeysJson && checkIntersection(element)) {
          try {
            const keys = JSON.parse(eventKeysJson) as EventKey[];
            intersectingKeys.push(...keys);
          } catch (e) {
            console.error('Failed to parse event keys:', e);
          }
        }
      });

      return intersectingKeys;
    },
    []
  );

  // Legacy: Find activity blocks that intersect with a rectangle (returns activity IDs only)
  const findIntersectingActivities = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      if (!gridContainerRef.current) return [];

      const intersecting: number[] = [];
      const activityElements = gridContainerRef.current.querySelectorAll('[data-activity-id]');

      activityElements.forEach((element) => {
        const activityId = parseInt(element.getAttribute('data-activity-id') || '0', 10);
        if (!activityId) return;

        const elementRect = element.getBoundingClientRect();
        const containerRect = gridContainerRef.current!.getBoundingClientRect();

        // Convert element position to container-relative coordinates
        const elemX = elementRect.left - containerRect.left;
        const elemY = elementRect.top - containerRect.top;
        const elemWidth = elementRect.width;
        const elemHeight = elementRect.height;

        // Check intersection
        const intersects =
          rect.x < elemX + elemWidth &&
          rect.x + rect.width > elemX &&
          rect.y < elemY + elemHeight &&
          rect.y + rect.height > elemY;

        if (intersects) {
          intersecting.push(activityId);
        }
      });

      return intersecting;
    },
    []
  );

  // Lasso mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start lasso on left click, not on activity blocks
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-activity-id]')) return; // Don't start lasso on activity blocks

      if (!gridContainerRef.current || !onLassoStart) return;

      const containerRect = gridContainerRef.current.getBoundingClientRect();
      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;
      // Store start point for preview rect calculation
      lassoStartRef.current = { x, y };
      onLassoStart(x, y);
    },
    [onLassoStart]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!gridContainerRef.current || !onLassoMove || !lassoRect || !lassoStartRef.current) return;

      const containerRect = gridContainerRef.current.getBoundingClientRect();
      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;
      onLassoMove(x, y);

      // Compute current lasso rectangle using stored start point
      const startX = lassoStartRef.current.x;
      const startY = lassoStartRef.current.y;
      const currentRect = {
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        width: Math.abs(x - startX),
        height: Math.abs(y - startY),
      };

      // Find intersecting events and update preview (new multi-type)
      if (onLassoPreviewKeys) {
        const intersectingKeys = findIntersectingEvents(currentRect);
        onLassoPreviewKeys(intersectingKeys);
      }

      // Legacy: Find intersecting activities and update preview
      if (onLassoPreview) {
        const intersecting = findIntersectingActivities(currentRect);
        onLassoPreview(intersecting);
      }
    },
    [onLassoMove, lassoRect, onLassoPreview, onLassoPreviewKeys, findIntersectingActivities, findIntersectingEvents]
  );

  const handleMouseUp = useCallback(() => {
    if (!lassoRect) return;

    // New: call multi-type event callback
    if (onLassoEndWithKeys) {
      const intersectingKeys = findIntersectingEvents(lassoRect);
      onLassoEndWithKeys(intersectingKeys);
    }

    // Legacy: call activity-only callback
    if (onLassoEnd) {
      const intersectingIds = findIntersectingActivities(lassoRect);
      onLassoEnd(intersectingIds);
    }

    lassoStartRef.current = null;
  }, [lassoRect, onLassoEnd, onLassoEndWithKeys, findIntersectingActivities, findIntersectingEvents]);

  if (!topApps || topApps.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground bg-muted/50 rounded-lg">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-50">📊</div>
          <div className="font-medium">No activity for this day</div>
          <div className="text-sm text-muted-foreground/70 mt-1">Start tracking to see your timeline</div>
        </div>
      </div>
    );
  }

  // Total height: header (44px) + 24 hours * hourHeight
  const gridHeight = HEADER_HEIGHT_PX + (24 * effectiveHourHeight);

  return (
    <div
      className={`relative bg-card border border-border flex-1 min-h-0 overflow-hidden ${
        lassoRect ? 'select-none cursor-crosshair' : ''
      }`}
      ref={gridContainerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Full-screen scrollable container - spans entire available space */}
      <ScrollArea className="h-full w-full" type="always">
        <div className="flex min-w-full relative" style={{ height: `${gridHeight}px`, minWidth: 'max-content' }}>
          {/* Hour Column (Sticky) */}
          <HourColumn hours={activeHours} hourHeight={effectiveHourHeight} />

          {/* AI Summary Column (Sticky) */}
          <AISummaryColumn
            sessionSummaries={sessionSummaries}
            hours={activeHours}
            onSessionClick={handleSessionClick}
            hourHeight={effectiveHourHeight}
            lassoPreviewKeys={lassoPreviewKeys}
            selectedEventKeys={selectedEventKeys}
          />

          {/* Projects Column - Shows project-assigned activities */}
          <ProjectsColumn
            entries={entries || []}
            hours={activeHours}
            hourHeight={effectiveHourHeight}
            selectedIds={selectedEntryIds}
            onEntryClick={(entry) => {
              // Could open a detail view or similar
              console.log('Entry clicked:', entry);
            }}
            onEntrySelect={(entry) => {
              toggleSelection({
                eventType: entry.eventType,
                eventId: entry.id,
                projectId: entry.projectId,
              });
            }}
          />

          {/* AFK Column - Shows away-from-keyboard periods */}
          {data.afkBlocks && Object.keys(data.afkBlocks).length > 0 && (
            <AFKColumn
              afkBlocks={data.afkBlocks}
              hours={activeHours}
              hourHeight={effectiveHourHeight}
              lassoPreviewKeys={lassoPreviewKeys}
              selectedEventKeys={selectedEventKeys}
            />
          )}

          {/* Screenshot Column */}
          {activeFilters.showScreenshots && (
            <ScreenshotColumn date={data.date} hours={activeHours} hourHeight={effectiveHourHeight} />
          )}

          {/* Git Column */}
          {activeFilters.showGit && (
            <GitColumn gitEvents={data.gitEvents || {}} hours={activeHours} hourHeight={effectiveHourHeight} lassoPreviewKeys={lassoPreviewKeys} selectedEventKeys={selectedEventKeys} />
          )}

          {/* Shell Column */}
          {activeFilters.showShell && (
            <ShellColumn shellEvents={data.shellEvents || {}} hours={activeHours} hourHeight={effectiveHourHeight} lassoPreviewKeys={lassoPreviewKeys} selectedEventKeys={selectedEventKeys} />
          )}

          {/* Files Column */}
          {activeFilters.showFiles && (
            <FilesColumn fileEvents={data.fileEvents || {}} hours={activeHours} hourHeight={effectiveHourHeight} lassoPreviewKeys={lassoPreviewKeys} selectedEventKeys={selectedEventKeys} />
          )}

          {/* Browser Column */}
          {activeFilters.showBrowser && (
            <BrowserColumn browserEvents={data.browserEvents || {}} hours={activeHours} hourHeight={effectiveHourHeight} lassoPreviewKeys={lassoPreviewKeys} selectedEventKeys={selectedEventKeys} />
          )}

          {/* App Columns (Scrollable) */}
          {appColumns.map((column) => (
            <AppColumn
              key={column.appName}
              appName={column.appName}
              category={column.category}
              totalDuration={column.totalDuration}
              activityBlocks={column.activityBlocks}
              hours={activeHours}
              onBlockClick={handleActivityBlockClick}
              hourHeight={effectiveHourHeight}
              selectedActivityIds={selectedActivityIds}
              onActivitySelect={onActivitySelect}
              onActivityDoubleClick={onActivityDoubleClick}
              lassoPreviewIds={lassoPreviewIds}
            />
          ))}

          {/* "Now" indicator line - red horizontal line showing current time */}
          {nowPosition !== null && (
            <div
              className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
              style={{ top: `${nowPosition}px` }}
            >
              {/* Red dot at the start */}
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shrink-0" />
              {/* Red line */}
              <div className="flex-1 h-0.5 bg-red-500" />
            </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* ImageGallery modal for activity block and session clicks */}
      <ImageGallery
        screenshots={galleryScreenshots}
        initialIndex={0}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />

      {/* Lasso selection overlay */}
      {lassoRect && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-50"
          style={{
            left: `${lassoRect.x}px`,
            top: `${lassoRect.y}px`,
            width: `${lassoRect.width}px`,
            height: `${lassoRect.height}px`,
          }}
        />
      )}

      {/* Assignment toolbar for bulk project assignment */}
      <AssignmentToolbar
        selectedActivities={selectedActivities}
        onClearSelection={clearSelection}
      />
    </div>
  );
};
