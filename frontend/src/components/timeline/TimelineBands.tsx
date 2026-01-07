import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Session, SessionSummary } from '@/types/session';
import type { Screenshot } from '@/types/screenshot';
import { formatDuration, formatTimestamp } from '@/lib/utils';

interface TimelineBandsProps {
  sessions: SessionSummary[];
  screenshots?: Screenshot[];
  date: Date;
  onSessionClick?: (sessionId: number) => void;
  highlightedTimeRange?: { startHour: number; endHour: number } | null;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const BAND_HEIGHT = 50; // Increased from 40 for better visibility (matches v1)
const HOUR_WIDTH = 60; // pixels per hour

function getTimePosition(timestamp: number, dayStart: number): number {
  // Calculate position as percentage of 24 hours
  const secondsFromStart = timestamp - dayStart;
  const hoursFromStart = secondsFromStart / 3600;
  return (hoursFromStart / 24) * 100;
}

function getSessionWidth(session: Session, dayStart: number): number {
  if (!session.durationSeconds) return 0;
  const durationHours = session.durationSeconds / 3600;
  return (durationHours / 24) * 100;
}

function getSessionColor(index: number): string {
  // More vibrant colors to match v1 design
  const colors = [
    'bg-green-600',
    'bg-blue-600',
    'bg-purple-600',
    'bg-pink-600',
    'bg-yellow-500', // Keep yellow at 500 for visibility
    'bg-orange-600',
  ];
  return colors[index % colors.length];
}

export function TimelineBands({
  sessions,
  screenshots = [],
  date,
  onSessionClick,
  highlightedTimeRange,
}: TimelineBandsProps) {
  const dayStart = useMemo(() => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return Math.floor(start.getTime() / 1000);
  }, [date]);

  const dayEnd = dayStart + 24 * 3600;

  // Filter screenshots to only those within the day
  const dayScreenshots = useMemo(() => {
    return screenshots.filter((s) => s.timestamp >= dayStart && s.timestamp < dayEnd);
  }, [screenshots, dayStart, dayEnd]);

  // Get sessions with summaries
  const sessionsWithSummaries = useMemo(() => {
    return sessions.filter((s) => s.summary);
  }, [sessions]);

  const LABEL_WIDTH = 80; // pixels for the label column

  // Reusable component for highlighted time range overlay
  const TimeRangeOverlay = () =>
    highlightedTimeRange ? (
      <div
        className="absolute bg-primary/10 border-l-2 border-r-2 border-primary/30"
        style={{
          left: `${(highlightedTimeRange.startHour / 24) * 100}%`,
          width: `${((highlightedTimeRange.endHour - highlightedTimeRange.startHour) / 24) * 100}%`,
          height: '100%',
          top: 0,
        }}
      />
    ) : null;

  return (
    <Card className="p-6 mb-6">
      <div className="space-y-3 overflow-hidden">{/* Increased spacing from 2 to 3 */}
        {/* Time axis labels */}
        <div className="flex">
          <div style={{ width: LABEL_WIDTH }} className="flex-shrink-0" />
          <div className="flex-1 relative h-6 mb-2 overflow-hidden">
            <div className="absolute inset-0 flex justify-between text-xs text-muted-foreground">
              {HOURS.filter((h) => h % 2 === 0).map((hour) => (
                <div key={hour} className="flex-shrink-0" style={{ width: `${100 / 12}%` }}>
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sessions Row */}
        <div className="flex items-center gap-3">
          <div
            style={{ width: LABEL_WIDTH }}
            className="flex-shrink-0 text-xs text-muted-foreground text-right pr-2"
          >
            Sessions
          </div>
          <div className="flex-1 relative overflow-hidden" style={{ height: BAND_HEIGHT }}>
            <div className="absolute inset-0 bg-muted/30 rounded border border-border/30 overflow-hidden">{/* Enhanced background and added border */}
              <TimeRangeOverlay />
              <TooltipProvider>
                {sessions.map((session, index) => {
                  const left = getTimePosition(session.startTime, dayStart);
                  const width = getSessionWidth(session, dayStart);
                  const color = getSessionColor(index);

                  return (
                    <Tooltip key={session.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={`absolute ${color} rounded cursor-pointer hover:opacity-80 transition-opacity`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            height: '100%',
                            top: 0,
                          }}
                          onClick={() => onSessionClick?.(session.id)}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <p className="font-semibold">
                            {formatTimestamp(session.startTime)} -{' '}
                            {session.endTime ? formatTimestamp(session.endTime) : 'ongoing'}
                          </p>
                          <p className="text-muted-foreground">
                            Duration: {formatDuration(session.durationSeconds || 0)}
                          </p>
                          <p className="text-muted-foreground">
                            {session.screenshotCount} screenshots
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Screenshots Row */}
        <div className="flex items-center gap-3">
          <div
            style={{ width: LABEL_WIDTH }}
            className="flex-shrink-0 text-xs text-muted-foreground text-right pr-2"
          >
            Screenshots
          </div>
          <div className="flex-1 relative" style={{ height: BAND_HEIGHT }}>
            <div className="absolute inset-0 bg-muted/30 rounded border border-border/30 overflow-hidden">{/* Enhanced background and added border */}
              <TimeRangeOverlay />
              {dayScreenshots.map((screenshot) => {
                const left = getTimePosition(screenshot.timestamp, dayStart);
                const width = 0.5; // Small width for each screenshot indicator

                return (
                  <div
                    key={screenshot.id}
                    className="absolute bg-slate-500 hover:bg-slate-400 cursor-pointer transition-colors"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      minWidth: '2px',
                      height: '100%',
                      top: 0,
                    }}
                    title={`Screenshot at ${formatTimestamp(screenshot.timestamp)}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Activity Row - Color-coded based on app/window type */}
        <div className="flex items-center gap-3">
          <div
            style={{ width: LABEL_WIDTH }}
            className="flex-shrink-0 text-xs text-muted-foreground text-right pr-2"
          >
            Activity
          </div>
          <div className="flex-1 relative overflow-hidden" style={{ height: BAND_HEIGHT }}>
            <div className="absolute inset-0 bg-muted/30 rounded border border-border/30 overflow-hidden">{/* Enhanced background and added border */}
              <TimeRangeOverlay />
              {/* For now, we'll show sessions with different colors to represent activity */}
              {sessions.map((session, index) => {
                const left = getTimePosition(session.startTime, dayStart);
                const width = getSessionWidth(session, dayStart);

                // Alternate between productive (green), neutral (gray), and distracting (red)
                // More vibrant colors to match v1
                const activityColors = [
                  'bg-green-500', // Productive/focus
                  'bg-gray-500',  // Neutral
                  'bg-red-500',   // Distracting
                ];
                const color = activityColors[index % 3];

                return (
                  <div
                    key={session.id}
                    className={`absolute ${color} opacity-70`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      height: '100%',
                      top: 0,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* AI Summaries Row */}
        <div className="flex items-center gap-3">
          <div
            style={{ width: LABEL_WIDTH }}
            className="flex-shrink-0 text-xs text-muted-foreground text-right pr-2"
          >
            Summaries
          </div>
          <div className="flex-1 relative overflow-hidden" style={{ height: BAND_HEIGHT }}>
            <div className="absolute inset-0 bg-muted/30 rounded border border-border/30 overflow-hidden">{/* Enhanced background and added border */}
              <TimeRangeOverlay />
              <TooltipProvider>
                {sessionsWithSummaries.map((session) => {
                  const left = getTimePosition(session.startTime, dayStart);
                  const width = getSessionWidth(session, dayStart);

                  return (
                    <Tooltip key={session.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute bg-blue-500 rounded cursor-pointer hover:bg-blue-400 transition-colors"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            height: '100%',
                            top: 0,
                          }}
                          onClick={() => onSessionClick?.(session.id)}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm max-w-xs">
                          <p className="font-semibold">AI Summary Available</p>
                          {session.summary?.summary && (
                            <p className="text-muted-foreground mt-1">
                              {session.summary.summary.slice(0, 100)}
                              {session.summary.summary.length > 100 ? '...' : ''}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 pt-3 border-t border-border/50 mt-3">
          <div
            style={{ width: LABEL_WIDTH }}
            className="flex-shrink-0 text-xs text-muted-foreground text-right pr-2"
          >
            Legend
          </div>
          <div className="flex-1 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="font-medium">Activity:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-green-500" />
                Productive
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-gray-500" />
                Neutral
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500" />
                Distracting
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-medium">Screenshots:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-500" />
                Captured
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-medium">Summaries:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-500" />
                AI Summary
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
