import React from 'react';
import { SessionSummaryWithPosition, CATEGORY_BORDER_COLORS, GRID_CONSTANTS } from '@/types/timeline';
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

export const AISummaryColumn: React.FC<AISummaryColumnProps> = ({
  sessionSummaries,
  hours,
}) => {
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
      className="sticky left-[50px] z-10 bg-background border-r border-border"
      style={{ width: `${GRID_CONSTANTS.AI_SUMMARY_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border p-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
            <span className="text-blue-500 text-xs">✨</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold">AI Summaries</div>
            <div className="text-[10px] text-muted-foreground">
              {sessionSummaries.length} session{sessionSummaries.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Hour Blocks */}
      <div className="relative">
        {hours.map((hour) => (
          <div
            key={hour}
            className="relative border-b border-border/30"
            style={{ height: `${GRID_CONSTANTS.HOUR_HEIGHT_PX}px` }}
          >
            {/* Empty state diagonal pattern */}
            <div
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
                backgroundSize: '10px 10px',
              }}
            />
          </div>
        ))}

        {/* Session Summary Blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {sessionSummaries.map((session) => {
            const actualHeight = Math.max(
              session.pixelHeight,
              GRID_CONSTANTS.MIN_SESSION_HEIGHT_PX
            );

            const categoryBorderClass =
              CATEGORY_BORDER_COLORS[session.category as keyof typeof CATEGORY_BORDER_COLORS] ||
              'border-l-gray-500';

            return (
              <TooltipProvider key={session.id} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`absolute left-0 right-0 mx-1 rounded bg-card border-l-4 ${categoryBorderClass} p-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                      style={{
                        top: `${session.pixelPosition}px`,
                        height: `${actualHeight}px`,
                        minHeight: `${GRID_CONSTANTS.MIN_SESSION_HEIGHT_PX}px`,
                      }}
                    >
                      <div className="text-[10px] text-muted-foreground mb-1">
                        {formatTime(session.startTime)}
                      </div>
                      <div className="text-xs line-clamp-2 leading-tight">
                        {session.summary || '(No summary)'}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-md">
                    <div className="space-y-2">
                      <div>
                        <div className="font-semibold mb-1">Session Summary</div>
                        <p className="text-sm">{session.summary || '(No summary)'}</p>
                      </div>
                      {session.explanation && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">
                            Explanation
                          </div>
                          <p className="text-xs text-muted-foreground">{session.explanation}</p>
                        </div>
                      )}
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
                              className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary"
                            >
                              {tag}
                            </span>
                          ))}
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
