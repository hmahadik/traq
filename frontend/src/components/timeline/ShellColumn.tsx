import React, { useMemo } from 'react';
import { Terminal, Check, X, Clock, Copy, FolderOpen } from 'lucide-react';
import { GRID_CONSTANTS, ShellEventDisplay } from '@/types/timeline';
import { groupShellEvents, GroupedShellEvent } from '@/utils/timelineHelpers';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ShellColumnProps {
  shellEvents: { [hour: number]: ShellEventDisplay[] };
  hours: number[];
  onCommandClick?: (event: ShellEventDisplay) => void;
  hourHeight?: number;
}

export const ShellColumn: React.FC<ShellColumnProps> = ({
  shellEvents,
  hours,
  onCommandClick,
  hourHeight,
}) => {
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;

  // Flatten and group all shell events by time proximity
  const groupedEvents = useMemo(() => {
    const allEvents: ShellEventDisplay[] = [];
    Object.values(shellEvents).forEach(events => {
      allEvents.push(...events);
    });
    const grouped = groupShellEvents(allEvents, 600); // 10 min gap threshold
    console.log(`[ShellColumn] ${allEvents.length} events -> ${grouped.length} grouped`);
    return grouped;
  }, [shellEvents]);

  // Calculate total commands for the day
  const totalCommands = Object.values(shellEvents).reduce((sum, events) => sum + events.length, 0);

  // Format duration display
  const formatDuration = (seconds: number): string => {
    if (seconds < 1) return '<1s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (minutes < 60) {
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  };

  // Format time for display
  const formatTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Truncate command for display
  const truncateCommand = (cmd: string, maxLength: number = 40): string => {
    if (cmd.length <= maxLength) return cmd;
    return cmd.substring(0, maxLength) + '...';
  };

  // Copy command to clipboard
  const copyCommand = (e: React.MouseEvent, command: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(command);
  };

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="w-5 h-5 rounded bg-slate-600 dark:bg-slate-500 flex items-center justify-center flex-shrink-0">
            <Terminal className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1 min-w-0 truncate text-xs font-medium text-foreground">Shell</div>
          <div className="text-[10px] text-muted-foreground flex-shrink-0">{totalCommands}</div>
        </div>
      </div>

      {/* Hour Blocks */}
      <div className="relative bg-card">
        {hours.map((hour, index) => (
          <div
            key={hour}
            className={`relative border-b border-border ${
              index % 2 === 0 ? 'bg-card' : 'bg-muted/30'
            }`}
            style={{ height: `${effectiveHourHeight}px` }}
          />
        ))}

        {/* Grouped Shell Event Blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {groupedEvents.map((group) => {
            // Calculate position based on startTimestamp
            const startDate = new Date(group.startTimestamp * 1000);
            const eventHour = startDate.getHours();
            const eventMinute = startDate.getMinutes();
            const firstHour = hours[0];
            const hourIndex = eventHour - firstHour;
            const minuteFraction = eventMinute / 60;
            const top = (hourIndex * effectiveHourHeight) + (minuteFraction * effectiveHourHeight);

            // Calculate height based on duration (or min height for single events)
            const durationSeconds = group.endTimestamp - group.startTimestamp;
            const durationHours = durationSeconds / 3600;
            const height = Math.max(32, durationHours * effectiveHourHeight);

            // Determine success/failure styling
            const hasFailures = group.failureCount > 0;
            const allSuccess = group.successCount === group.mergedCount;
            const borderColor = hasFailures
              ? 'border-red-300 dark:border-red-700'
              : 'border-slate-300 dark:border-slate-700';
            const bgColor = hasFailures
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-slate-100 dark:bg-slate-900/30';

            return (
              <TooltipProvider key={group.id} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute left-0 right-0 mx-1 cursor-pointer hover:shadow-md transition-shadow"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                      }}
                      onClick={() => onCommandClick?.(group.events[0] as unknown as ShellEventDisplay)}
                    >
                      <div className={`${bgColor} border ${borderColor} rounded-md px-2 py-1 h-full overflow-hidden`}>
                        {/* Header with count and status */}
                        <div className="flex items-center gap-1">
                          <Terminal className="w-3 h-3 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                          {allSuccess ? (
                            <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                          ) : hasFailures ? (
                            <X className="w-2.5 h-2.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                          ) : null}
                          <span className="text-[10px] font-mono text-foreground truncate flex-1">
                            {group.mergedCount > 1
                              ? `${group.mergedCount} cmds`
                              : truncateCommand(group.command, 15)}
                          </span>
                        </div>
                        {/* Duration - only show if tall enough */}
                        {height >= 40 && group.totalDurationSeconds > 0 && (
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {formatDuration(group.totalDurationSeconds)}
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-md p-3">
                    <div className="space-y-3">
                      {/* Header with status */}
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-sm">
                          {group.mergedCount > 1
                            ? `${group.mergedCount} Commands`
                            : group.shellType}
                        </span>
                        {allSuccess ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <Check className="w-3 h-3" />
                            {group.mergedCount > 1 ? `${group.successCount} passed` : 'Exit 0'}
                          </span>
                        ) : hasFailures && (
                          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <X className="w-3 h-3" />
                            {group.failureCount} failed
                          </span>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(group.startTimestamp)}
                        </span>
                        {group.totalDurationSeconds > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatDuration(group.totalDurationSeconds)} total</span>
                          </>
                        )}
                      </div>

                      {/* Directories */}
                      {group.directories.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {group.directories.slice(0, 3).map((dir, idx) => (
                            <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono truncate max-w-[200px]">
                              {dir}
                            </span>
                          ))}
                          {group.directories.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{group.directories.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Command list */}
                      {group.events.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-border">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                            Commands
                          </div>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {group.events.slice(0, 8).map((cmd) => (
                              <div key={cmd.id} className="relative">
                                <div className="flex items-center gap-1 mb-0.5">
                                  {cmd.exitCode === 0 ? (
                                    <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                                  ) : (
                                    <X className="w-2.5 h-2.5 text-red-600 dark:text-red-400" />
                                  )}
                                  <span className="text-[9px] text-muted-foreground">
                                    {formatTime(cmd.timestamp)}
                                  </span>
                                </div>
                                <pre className="text-[10px] font-mono bg-muted px-2 py-1 rounded overflow-x-auto whitespace-pre-wrap break-all">
                                  {cmd.command}
                                </pre>
                                <button
                                  onClick={(e) => copyCommand(e, cmd.command)}
                                  className="absolute top-5 right-1 p-0.5 hover:bg-background rounded transition-colors"
                                  title="Copy command"
                                >
                                  <Copy className="w-3 h-3 text-muted-foreground" />
                                </button>
                              </div>
                            ))}
                            {group.events.length > 8 && (
                              <div className="text-[10px] text-muted-foreground/70 italic">
                                +{group.events.length - 8} more...
                              </div>
                            )}
                          </div>
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
