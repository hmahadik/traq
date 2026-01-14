import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Network } from 'lucide-react';
import { TimelineGridData, GRID_CONSTANTS, ActivityBlock as ActivityBlockType, SessionSummaryWithPosition } from '@/types/timeline';
import { HourColumn } from './HourColumn';
import { AISummaryColumn } from './AISummaryColumn';
import { ScreenshotColumn } from './ScreenshotColumn';
import { AppColumn } from './AppColumn';
import { GitColumn } from './GitColumn';
import { ShellColumn } from './ShellColumn';
import { FilesColumn } from './FilesColumn';
import { BrowserColumn } from './BrowserColumn';
import { ClusterColumn } from './ClusterColumn';
import { AFKColumn } from './AFKColumn';
import { TimelineFilters } from './FilterControls';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ImageGallery } from '@/components/common/ImageGallery';
import { useScreenshotsForDate } from '@/api/hooks';
import type { Screenshot } from '@/types';

interface TimelineGridViewProps {
  data: TimelineGridData;
  filters?: TimelineFilters;
  hourHeight?: number; // Dynamic hour height for zoom (default: GRID_CONSTANTS.HOUR_HEIGHT_PX)
  onSessionClick?: (sessionId: number) => void; // Callback when session is clicked
}

// Header height for column headers (matches the header in HourColumn/AppColumn)
const HEADER_HEIGHT_PX = 44;

export const TimelineGridView: React.FC<TimelineGridViewProps> = ({ data, filters, hourHeight, onSessionClick }) => {
  const { hourlyGrid, sessionSummaries, topApps } = data;

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

  if (topApps.length === 0) {
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
    <div className="relative bg-card border border-border flex-1 min-h-0 overflow-hidden">
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
          />

          {/* AFK Column - Shows away-from-keyboard periods */}
          {data.afkBlocks && Object.keys(data.afkBlocks).length > 0 && (
            <AFKColumn
              afkBlocks={data.afkBlocks}
              hours={activeHours}
              hourHeight={effectiveHourHeight}
            />
          )}

          {/* Activity Clusters Column - Shows related events grouped by temporal proximity */}
          {data.activityClusters && Object.keys(data.activityClusters).length > 0 && (
            <div
              className="relative border-r border-border"
              style={{ minWidth: '100px' }}
            >
              {/* Column header - Fixed height */}
              <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
                <div className="flex items-center gap-1.5 w-full min-w-0">
                  <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <Network className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-medium text-foreground truncate">Clusters</span>
                </div>
              </div>

              {/* Hour blocks */}
              {activeHours.map((hour, index) => {
                const clusters = data.activityClusters?.[hour] || [];
                return (
                  <div
                    key={hour}
                    className={`relative border-b border-gray-100 dark:border-gray-800 ${
                      index % 2 === 0 ? 'bg-card' : 'bg-muted/30'
                    }`}
                    style={{ height: `${effectiveHourHeight}px` }}
                  >
                    {clusters.length > 0 && (
                      <ClusterColumn clusters={clusters} hourHeight={effectiveHourHeight} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Screenshot Column */}
          {activeFilters.showScreenshots && (
            <ScreenshotColumn date={data.date} hours={activeHours} hourHeight={effectiveHourHeight} />
          )}

          {/* Git Column */}
          {activeFilters.showGit && (
            <GitColumn gitEvents={data.gitEvents || {}} hours={activeHours} hourHeight={effectiveHourHeight} />
          )}

          {/* Shell Column */}
          {activeFilters.showShell && (
            <ShellColumn shellEvents={data.shellEvents || {}} hours={activeHours} hourHeight={effectiveHourHeight} />
          )}

          {/* Files Column */}
          {activeFilters.showFiles && (
            <FilesColumn fileEvents={data.fileEvents || {}} hours={activeHours} hourHeight={effectiveHourHeight} />
          )}

          {/* Browser Column */}
          {activeFilters.showBrowser && (
            <BrowserColumn browserEvents={data.browserEvents || {}} hours={activeHours} hourHeight={effectiveHourHeight} />
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
    </div>
  );
};
