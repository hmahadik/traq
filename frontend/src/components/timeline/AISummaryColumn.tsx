import React, { useMemo } from 'react';
import { SessionSummaryWithPosition, GRID_CONSTANTS, getAppColors } from '@/types/timeline';
import { snapTo15Minutes } from '@/utils/timelineHelpers';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AISummaryColumnProps {
  sessionSummaries: SessionSummaryWithPosition[];
  hours: number[]; // Array of hours for grid alignment
}

// Category to border color mapping (Timely-style)
const CATEGORY_BORDERS: Record<string, string> = {
  focus: 'border-l-emerald-500',
  meetings: 'border-l-red-400',
  comms: 'border-l-purple-400',
  other: 'border-l-gray-400',
};

export const AISummaryColumn: React.FC<AISummaryColumnProps> = ({
  sessionSummaries,
  hours,
}) => {
  // Process sessions to snap to 15-minute boundaries for cleaner display
  const snappedSessions = useMemo(() => {
    return sessionSummaries.map(session => {
      // Snap start time to 15-minute floor
      const snappedStart = snapTo15Minutes(session.startTime, 'floor');
      // Snap end time to 15-minute ceiling (to ensure we don't shrink duration)
      const snappedEnd = session.endTime
        ? snapTo15Minutes(session.endTime, 'ceil')
        : null;

      // Recalculate position based on snapped times
      const snappedDate = new Date(snappedStart * 1000);
      const snappedHour = snappedDate.getHours();
      const snappedMinute = snappedDate.getMinutes();

      // Calculate new pixel position and height
      const minuteFraction = snappedMinute / 60;
      const newPixelPosition = minuteFraction * 60; // Using base 60px (will be scaled)

      // Calculate new duration
      const newDurationSeconds = snappedEnd
        ? snappedEnd - snappedStart
        : session.durationSeconds;

      // Calculate pixel height based on duration
      const durationMinutes = (newDurationSeconds || 0) / 60;
      const newPixelHeight = (durationMinutes / 60) * 60; // Using base 60px

      return {
        ...session,
        startTime: snappedStart,
        endTime: snappedEnd || session.endTime,
        hourOffset: snappedHour,
        minuteOffset: snappedMinute,
        pixelPosition: newPixelPosition,
        pixelHeight: Math.max(newPixelHeight, 14), // Minimum height
        durationSeconds: newDurationSeconds,
      };
    });
  }, [sessionSummaries]);

  // Format time
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Format duration
  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div
      className="sticky left-[60px] z-10 bg-muted border-r border-border"
      style={{ width: `${GRID_CONSTANTS.AI_SUMMARY_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header - Timely style */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-amber-500 dark:bg-amber-600 flex items-center justify-center">
            <span className="text-[10px]">✨</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground">AI Summary</div>
          </div>
          <div className="text-[11px] text-muted-foreground font-medium">
            {snappedSessions.length} session{snappedSessions.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Hour Blocks */}
      <div className="relative">
        {hours.map((hour) => (
          <div
            key={hour}
            className="relative border-b border-border"
            style={{ height: `${GRID_CONSTANTS.HOUR_HEIGHT_PX}px` }}
          />
        ))}

        {/* Session Summary Blocks (absolutely positioned) - using snapped sessions */}
        <div className="absolute inset-0">
          {snappedSessions.map((session) => {
            // Scale to new hour height
            const scaledPixelPosition = (session.pixelPosition / 60) * GRID_CONSTANTS.HOUR_HEIGHT_PX;
            const scaledPixelHeight = (session.pixelHeight / 60) * GRID_CONSTANTS.HOUR_HEIGHT_PX;
            const actualHeight = Math.max(scaledPixelHeight, GRID_CONSTANTS.MIN_SESSION_HEIGHT_PX);

            // Calculate absolute position
            const hourIndex = hours.indexOf(session.hourOffset);
            const absoluteTop = hourIndex >= 0
              ? (hourIndex * GRID_CONSTANTS.HOUR_HEIGHT_PX) + scaledPixelPosition
              : scaledPixelPosition;

            const borderClass = CATEGORY_BORDERS[session.category] || CATEGORY_BORDERS.other;

            // Determine what to show based on height
            const showSummary = actualHeight >= 28;
            const showTime = actualHeight >= 20;

            return (
              <TooltipProvider key={session.id} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`absolute left-1 right-1 rounded-md bg-card border border-border border-l-4 ${borderClass} shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden`}
                      style={{
                        top: `${absoluteTop}px`,
                        height: `${actualHeight}px`,
                      }}
                    >
                      <div className="p-2 h-full flex flex-col">
                        {showTime && (
                          <div className="text-[10px] text-muted-foreground mb-0.5">
                            {formatTime(session.startTime)}
                          </div>
                        )}
                        {showSummary && (
                          <div className="text-[11px] text-foreground leading-tight line-clamp-2 flex-1">
                            {session.summary || '(Processing...)'}
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-sm">
                    <div className="space-y-2">
                      <div>
                        <div className="font-semibold text-sm mb-1">
                          {session.summary || '(No summary)'}
                        </div>
                        {session.explanation && (
                          <p className="text-xs text-muted-foreground">
                            {session.explanation}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatTime(session.startTime)}</span>
                        {session.endTime && (
                          <>
                            <span>→</span>
                            <span>{formatTime(session.endTime)}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatDuration(session.durationSeconds)}</span>
                      </div>
                      {session.tags && session.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {session.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {session.topApps && session.topApps.length > 0 && (
                        <div className="flex items-center gap-1">
                          {session.topApps.slice(0, 4).map((app, idx) => {
                            const colors = getAppColors(app);
                            return (
                              <div
                                key={idx}
                                className={`w-5 h-5 rounded ${colors.icon} flex items-center justify-center`}
                                title={app}
                              >
                                <span className="text-[8px] font-bold text-white">
                                  {app.substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
