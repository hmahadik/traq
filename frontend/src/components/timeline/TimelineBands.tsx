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
const BAND_HEIGHT = 40;
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
  const colors = [
    'bg-green-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-orange-500',
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

  return (
    <Card className="p-6 mb-6">
      <div className="space-y-2">
        {/* Time axis labels */}
        <div className="relative h-6 mb-2">
          <div className="absolute inset-0 flex justify-between text-xs text-muted-foreground">
            {HOURS.filter((h) => h % 2 === 0).map((hour) => (
              <div key={hour} className="flex-shrink-0" style={{ width: `${100 / 12}%` }}>
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
            ))}
          </div>
        </div>

        {/* Sessions Row */}
        <div className="relative" style={{ height: BAND_HEIGHT }}>
          <div className="absolute inset-0 bg-muted/20 rounded">
            {/* Highlighted time range overlay */}
            {highlightedTimeRange && (
              <div
                className="absolute bg-primary/10 border-l-2 border-r-2 border-primary/30"
                style={{
                  left: `${(highlightedTimeRange.startHour / 24) * 100}%`,
                  width: `${((highlightedTimeRange.endHour - highlightedTimeRange.startHour) / 24) * 100}%`,
                  height: '100%',
                  top: 0,
                }}
              />
            )}
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
          <div className="absolute left-0 text-xs text-muted-foreground -ml-16 top-2">
            Sessions
          </div>
        </div>

        {/* Screenshots Row */}
        <div className="relative" style={{ height: BAND_HEIGHT }}>
          <div className="absolute inset-0 bg-muted/20 rounded overflow-hidden">
            {/* Highlighted time range overlay */}
            {highlightedTimeRange && (
              <div
                className="absolute bg-primary/10 border-l-2 border-r-2 border-primary/30"
                style={{
                  left: `${(highlightedTimeRange.startHour / 24) * 100}%`,
                  width: `${((highlightedTimeRange.endHour - highlightedTimeRange.startHour) / 24) * 100}%`,
                  height: '100%',
                  top: 0,
                }}
              />
            )}
            {dayScreenshots.map((screenshot) => {
              const left = getTimePosition(screenshot.timestamp, dayStart);
              const width = 0.5; // Small width for each screenshot indicator

              return (
                <div
                  key={screenshot.id}
                  className="absolute bg-slate-400 hover:bg-slate-300 cursor-pointer transition-colors"
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
          <div className="absolute left-0 text-xs text-muted-foreground -ml-16 top-2">
            Screenshots
          </div>
        </div>

        {/* Activity Row - Color-coded based on app/window type */}
        <div className="relative" style={{ height: BAND_HEIGHT }}>
          <div className="absolute inset-0 bg-muted/20 rounded">
            {/* Highlighted time range overlay */}
            {highlightedTimeRange && (
              <div
                className="absolute bg-primary/10 border-l-2 border-r-2 border-primary/30"
                style={{
                  left: `${(highlightedTimeRange.startHour / 24) * 100}%`,
                  width: `${((highlightedTimeRange.endHour - highlightedTimeRange.startHour) / 24) * 100}%`,
                  height: '100%',
                  top: 0,
                }}
              />
            )}
            {/* For now, we'll show sessions with different colors to represent activity */}
            {sessions.map((session, index) => {
              const left = getTimePosition(session.startTime, dayStart);
              const width = getSessionWidth(session, dayStart);

              // Alternate between productive (green), neutral (gray), and distracting (red)
              const activityColors = [
                'bg-green-400', // Productive/focus
                'bg-gray-400',  // Neutral
                'bg-red-400',   // Distracting
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
          <div className="absolute left-0 text-xs text-muted-foreground -ml-16 top-2">
            Activity
          </div>
        </div>

        {/* AI Summaries Row */}
        <div className="relative" style={{ height: BAND_HEIGHT }}>
          <div className="absolute inset-0 bg-muted/20 rounded">
            {/* Highlighted time range overlay */}
            {highlightedTimeRange && (
              <div
                className="absolute bg-primary/10 border-l-2 border-r-2 border-primary/30"
                style={{
                  left: `${(highlightedTimeRange.startHour / 24) * 100}%`,
                  width: `${((highlightedTimeRange.endHour - highlightedTimeRange.startHour) / 24) * 100}%`,
                  height: '100%',
                  top: 0,
                }}
              />
            )}
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
          <div className="absolute left-0 text-xs text-muted-foreground -ml-16 top-2">
            Summaries
          </div>
        </div>

        {/* Hour grid lines */}
        <div className="absolute inset-0 pointer-events-none">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute top-0 bottom-0 border-l border-border/30"
              style={{ left: `${(hour / 24) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
