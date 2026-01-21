import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { AFKBlock, GRID_CONSTANTS, DayStats } from '@/types/timeline';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActivityBlock {
  id: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  hourOffset: number;
  minuteOffset: number;
  pixelPosition: number;
  pixelHeight: number;
}

interface ActivityColumnProps {
  afkBlocks: Record<number, AFKBlock[]>;
  dayStats?: DayStats | null;
  hours: number[];
  hourHeight?: number;
  lassoPreviewKeys?: Set<string>;
  selectedEventKeys?: Set<string>;
}

// Header height for column headers (matches the header in HourColumn/AppColumn)
const HEADER_HEIGHT_PX = 44;

export const ActivityColumn: React.FC<ActivityColumnProps> = ({
  afkBlocks,
  dayStats,
  hours,
  hourHeight,
  lassoPreviewKeys,
  selectedEventKeys
}) => {
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;

  // Calculate activity blocks as the inverse of AFK blocks within the day span
  const activityBlocks = useMemo(() => {
    if (!dayStats?.daySpan) {
      return [];
    }

    const dayStart = dayStats.daySpan.startTime;
    const dayEnd = dayStats.daySpan.endTime;

    // Collect all AFK periods and sort them
    const allAfkBlocks = Object.values(afkBlocks)
      .flat()
      .sort((a, b) => a.startTime - b.startTime);

    // Calculate activity periods as gaps between AFK periods
    const activities: ActivityBlock[] = [];
    let currentStart = dayStart;
    let activityId = 0;

    for (const afk of allAfkBlocks) {
      // If there's a gap before this AFK period, that's an activity period
      if (afk.startTime > currentStart) {
        const activityEnd = afk.startTime;
        const durationSeconds = activityEnd - currentStart;

        // Only include if duration is at least 60 seconds
        if (durationSeconds >= 60) {
          const startDate = new Date(currentStart * 1000);
          const hour = startDate.getHours();
          const minute = startDate.getMinutes();
          const pixelPosition = (minute / 60) * effectiveHourHeight;
          const pixelHeight = (durationSeconds / 3600) * effectiveHourHeight;

          activities.push({
            id: `activity-${activityId++}`,
            startTime: currentStart,
            endTime: activityEnd,
            durationSeconds,
            hourOffset: hour,
            minuteOffset: minute,
            pixelPosition,
            pixelHeight: Math.max(pixelHeight, GRID_CONSTANTS.MIN_BLOCK_HEIGHT_PX),
          });
        }
      }
      // Move past this AFK period
      currentStart = Math.max(currentStart, afk.endTime);
    }

    // Add final activity period after last AFK
    if (currentStart < dayEnd) {
      const durationSeconds = dayEnd - currentStart;

      if (durationSeconds >= 60) {
        const startDate = new Date(currentStart * 1000);
        const hour = startDate.getHours();
        const minute = startDate.getMinutes();
        const pixelPosition = (minute / 60) * effectiveHourHeight;
        const pixelHeight = (durationSeconds / 3600) * effectiveHourHeight;

        activities.push({
          id: `activity-${activityId++}`,
          startTime: currentStart,
          endTime: dayEnd,
          durationSeconds,
          hourOffset: hour,
          minuteOffset: minute,
          pixelPosition,
          pixelHeight: Math.max(pixelHeight, GRID_CONSTANTS.MIN_BLOCK_HEIGHT_PX),
        });
      }
    }

    // If no AFK blocks, the entire day span is active
    if (allAfkBlocks.length === 0) {
      const durationSeconds = dayEnd - dayStart;
      const startDate = new Date(dayStart * 1000);
      const hour = startDate.getHours();
      const minute = startDate.getMinutes();
      const pixelPosition = (minute / 60) * effectiveHourHeight;
      const pixelHeight = (durationSeconds / 3600) * effectiveHourHeight;

      activities.push({
        id: 'activity-0',
        startTime: dayStart,
        endTime: dayEnd,
        durationSeconds,
        hourOffset: hour,
        minuteOffset: minute,
        pixelPosition,
        pixelHeight: Math.max(pixelHeight, GRID_CONSTANTS.MIN_BLOCK_HEIGHT_PX),
      });
    }

    return activities;
  }, [afkBlocks, dayStats, effectiveHourHeight]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${Math.floor(seconds)}s`;
  };

  // Format time
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="relative border-r border-border" style={{ minWidth: '80px' }}>
      {/* Column header - Fixed height */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Activity className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-medium text-foreground truncate">Activity</span>
        </div>
      </div>

      {/* Hour blocks - just backgrounds for zebra stripes */}
      <div className="relative">
        {hours.map((hour, index) => (
          <div
            key={hour}
            className={`relative border-b border-gray-100 dark:border-gray-800 ${
              index % 2 === 0 ? 'bg-card' : 'bg-muted/30'
            }`}
            style={{ height: `${effectiveHourHeight}px` }}
          />
        ))}

        {/* Activity blocks - absolutely positioned overlay */}
        <div className="absolute inset-0">
          {activityBlocks.map((block) => {
            // Calculate absolute position from the top of the column
            const hourIndex = hours.indexOf(block.hourOffset);
            const scaledPixelPosition = (block.minuteOffset / 60) * effectiveHourHeight;

            // Calculate absolute top position
            const absoluteTop = hourIndex >= 0
              ? (hourIndex * effectiveHourHeight) + scaledPixelPosition
              : scaledPixelPosition;

            // Check if this activity block is highlighted
            const key = `activity:${block.id}`;
            const isHighlighted = lassoPreviewKeys?.has(key) || selectedEventKeys?.has(key);

            return (
              <TooltipProvider key={block.id} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`absolute left-1 right-1 rounded-lg cursor-help overflow-hidden border border-emerald-400 dark:border-emerald-600 bg-emerald-100/80 dark:bg-emerald-900/80 backdrop-blur-sm hover:shadow-md transition-all ${
                        isHighlighted ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                      }`}
                      style={{
                        top: `${absoluteTop}px`,
                        height: `${block.pixelHeight}px`,
                      }}
                      data-event-key={key}
                      role="button"
                      aria-label={`Active from ${formatTime(block.startTime)} for ${formatDuration(block.durationSeconds)}`}
                    >
                      {/* Activity indicator - only show icon if block is tall enough */}
                      {block.pixelHeight >= 18 && (
                        <div className="flex items-center justify-center h-full">
                          <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-sm p-3">
                    <div className="space-y-2">
                      {/* Header */}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center">
                          <Activity className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-semibold text-sm">Active Period</span>
                      </div>

                      {/* Time info */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatTime(block.startTime)} - {formatTime(block.endTime)}</span>
                      </div>

                      {/* Duration */}
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Duration: </span>
                        {formatDuration(block.durationSeconds)}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    </div>
  );
};
