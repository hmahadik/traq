import React, { useMemo } from 'react';
import { TimelineGridData, GRID_CONSTANTS } from '@/types/timeline';
import { HourColumn } from './HourColumn';
import { AISummaryColumn } from './AISummaryColumn';
import { AppColumn } from './AppColumn';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TimelineGridViewProps {
  data: TimelineGridData;
}

export const TimelineGridView: React.FC<TimelineGridViewProps> = ({ data }) => {
  const { hourlyGrid, sessionSummaries, topApps } = data;

  // Calculate active hours range
  const activeHours = useMemo(() => {
    const hours = new Set<number>();

    // Add hours from activity
    Object.keys(hourlyGrid).forEach((hourStr) => {
      hours.add(parseInt(hourStr, 10));
    });

    // Add hours from sessions
    sessionSummaries.forEach((session) => {
      hours.add(session.hourOffset);
    });

    if (hours.size === 0) {
      // Default to work hours if no activity
      return Array.from({ length: 10 }, (_, i) => i + 8); // 8 AM to 5 PM
    }

    // Get min/max hours
    const sortedHours = Array.from(hours).sort((a, b) => a - b);
    const minHour = Math.max(0, sortedHours[0] - 1); // Buffer 1 hour before
    const maxHour = Math.min(23, sortedHours[sortedHours.length - 1] + 1); // Buffer 1 hour after

    // Generate hour range
    const result: number[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      result.push(h);
    }
    return result;
  }, [hourlyGrid, sessionSummaries]);

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
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <div>No activity for this day</div>
          <div className="text-sm">Start tracking time to see your timeline</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Horizontal Scrollable Grid */}
      <ScrollArea className="w-full">
        <div className="flex min-w-full">
          {/* Hour Column (Sticky) */}
          <HourColumn hours={activeHours} />

          {/* AI Summary Column (Sticky) */}
          <AISummaryColumn sessionSummaries={sessionSummaries} hours={activeHours} />

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
        </div>
      </ScrollArea>
    </div>
  );
};
