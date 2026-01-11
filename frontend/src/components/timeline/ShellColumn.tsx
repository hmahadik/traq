import React from 'react';
import { Terminal, Check, X, Clock } from 'lucide-react';
import { GRID_CONSTANTS, ShellEventDisplay } from '@/types/timeline';

interface ShellColumnProps {
  shellEvents: { [hour: number]: ShellEventDisplay[] };
  hours: number[]; // Array of hours for grid alignment
  onCommandClick?: (event: ShellEventDisplay) => void;
}

export const ShellColumn: React.FC<ShellColumnProps> = ({
  shellEvents,
  hours,
  onCommandClick,
}) => {
  // Calculate total commands for the day
  const totalCommands = Object.values(shellEvents).reduce((sum, events) => sum + events.length, 0);

  // Format duration display
  const formatDuration = (seconds: number): string => {
    if (seconds < 1) return '<1s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  // Truncate command for display
  const truncateCommand = (cmd: string, maxLength: number = 40): string => {
    if (cmd.length <= maxLength) return cmd;
    return cmd.substring(0, maxLength) + '...';
  };

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          {/* Terminal icon */}
          <div className="w-5 h-5 rounded bg-slate-600 dark:bg-slate-500 flex items-center justify-center flex-shrink-0">
            <Terminal className="w-3 h-3 text-white" />
          </div>
          {/* Column name */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">Shell</div>
          </div>
          {/* Total commands badge */}
          <div className="text-[11px] text-muted-foreground font-medium">
            {totalCommands} {totalCommands === 1 ? 'cmd' : 'cmds'}
          </div>
        </div>
      </div>

      {/* Hour Blocks with Shell Events */}
      <div className="relative bg-card">
        {hours.map((hour) => (
          <div
            key={hour}
            className="relative border-b border-border"
            style={{ height: `${GRID_CONSTANTS.HOUR_HEIGHT_PX}px` }}
          >
            {/* Subtle grid pattern for empty state */}
            <div
              className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
                backgroundSize: '8px 8px',
              }}
            />
          </div>
        ))}

        {/* Shell Event Blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {Object.entries(shellEvents).map(([hour, events]) =>
            events.map((event) => {
              // Calculate position relative to the first hour in the display
              const firstHour = hours[0];
              const hourIndex = parseInt(hour) - firstHour;
              const top = hourIndex * GRID_CONSTANTS.HOUR_HEIGHT_PX + event.pixelPosition;

              // Determine success/failure color
              const isSuccess = event.exitCode === 0;
              const borderColor = isSuccess
                ? 'border-slate-300 dark:border-slate-700'
                : 'border-red-300 dark:border-red-700';
              const bgColor = isSuccess
                ? 'bg-slate-100 dark:bg-slate-900/30'
                : 'bg-red-50 dark:bg-red-900/20';

              return (
                <div
                  key={event.id}
                  className="absolute left-0 right-0 mx-2 cursor-pointer hover:shadow-md transition-shadow"
                  style={{
                    top: `${top}px`,
                    minHeight: '32px',
                  }}
                  onClick={() => onCommandClick?.(event)}
                >
                  <div className={`${bgColor} border ${borderColor} rounded-md px-2 py-1.5`}>
                    {/* Command header */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <Terminal className="w-3 h-3 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                      {/* Exit code indicator */}
                      {isSuccess ? (
                        <Check className="w-3 h-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                      ) : (
                        <X className="w-3 h-3 text-red-600 dark:text-red-400 flex-shrink-0" />
                      )}
                      <span className="text-[10px] text-muted-foreground truncate flex-1">
                        {event.shellType}
                      </span>
                    </div>

                    {/* Command text */}
                    <div className="text-[11px] font-mono text-foreground line-clamp-2 leading-tight mb-1">
                      {truncateCommand(event.command, 35)}
                    </div>

                    {/* Working directory and duration */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {event.workingDirectory && (
                        <span className="truncate flex-1">
                          {event.workingDirectory.split('/').slice(-2).join('/')}
                        </span>
                      )}
                      {event.durationSeconds > 0 && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatDuration(event.durationSeconds)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
