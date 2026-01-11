import React, { useMemo, useState, useEffect } from 'react';
import { TimelineGridData, GRID_CONSTANTS } from '@/types/timeline';
import { HourColumn } from './HourColumn';
import { AISummaryColumn } from './AISummaryColumn';
import { ScreenshotColumn } from './ScreenshotColumn';
import { AppColumn } from './AppColumn';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TimelineGridViewProps {
  data: TimelineGridData;
}

// Header height for column headers (matches the header in HourColumn/AppColumn)
const HEADER_HEIGHT_PX = 44;

export const TimelineGridView: React.FC<TimelineGridViewProps> = ({ data }) => {
  const { hourlyGrid, sessionSummaries, topApps } = data;

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
      const position = HEADER_HEIGHT_PX + (currentHour * GRID_CONSTANTS.HOUR_HEIGHT_PX) +
        (currentMinute / 60 * GRID_CONSTANTS.HOUR_HEIGHT_PX);
      setNowPosition(position);
    };

    updateNowPosition();
    const interval = setInterval(updateNowPosition, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isToday]);

  // Always show full 24-hour day (12 AM to 11 PM)
  const activeHours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i); // 0-23 (12 AM to 11 PM)
  }, []);

  // Prepare app columns data
  const appColumns = useMemo(() => {
    return topApps.map((app) => {
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

  // Total height: header (44px) + 24 hours * 80px = 1964px
  const gridHeight = HEADER_HEIGHT_PX + (24 * GRID_CONSTANTS.HOUR_HEIGHT_PX);

  return (
    <div className="relative bg-card border border-border flex-1 min-h-0 overflow-hidden">
      {/* Full-screen scrollable container - spans entire available space */}
      <ScrollArea className="h-full w-full" style={{ height: 'calc(100vh - 12rem)' }}>
        <div className="flex min-w-full relative" style={{ height: `${gridHeight}px`, minWidth: 'max-content' }}>
          {/* Hour Column (Sticky) */}
          <HourColumn hours={activeHours} />

          {/* AI Summary Column (Sticky) */}
          <AISummaryColumn sessionSummaries={sessionSummaries} hours={activeHours} />

          {/* Screenshot Column */}
          <ScreenshotColumn date={data.date} hours={activeHours} />

          {/* App Columns (Scrollable) */}
          {appColumns.map((column) => (
            <AppColumn
              key={column.appName}
              appName={column.appName}
              category={column.category}
              totalDuration={column.totalDuration}
              activityBlocks={column.activityBlocks}
              hours={activeHours}
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
      </ScrollArea>
    </div>
  );
};
