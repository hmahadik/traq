import React from 'react';
import { GitBranch, Plus, Minus } from 'lucide-react';
import { GRID_CONSTANTS, GitEventDisplay } from '@/types/timeline';

interface GitColumnProps {
  gitEvents: { [hour: number]: GitEventDisplay[] };
  hours: number[]; // Array of hours for grid alignment
  onCommitClick?: (event: GitEventDisplay) => void;
}

export const GitColumn: React.FC<GitColumnProps> = ({
  gitEvents,
  hours,
  onCommitClick,
}) => {
  // Calculate total commits for the day
  const totalCommits = Object.values(gitEvents).reduce((sum, events) => sum + events.length, 0);

  // Format insertions/deletions display
  const formatChanges = (insertions: number, deletions: number): string => {
    return `+${insertions} -${deletions}`;
  };

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          {/* Git icon */}
          <div className="w-5 h-5 rounded bg-purple-500 flex items-center justify-center flex-shrink-0">
            <GitBranch className="w-3 h-3 text-white" />
          </div>
          {/* Column name */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">Git</div>
          </div>
          {/* Total commits badge */}
          <div className="text-[11px] text-muted-foreground font-medium">
            {totalCommits} {totalCommits === 1 ? 'commit' : 'commits'}
          </div>
        </div>
      </div>

      {/* Hour Blocks with Git Events */}
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

        {/* Git Event Blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {Object.entries(gitEvents).map(([hour, events]) =>
            events.map((event) => {
              // Calculate position relative to the first hour in the display
              const firstHour = hours[0];
              const hourIndex = parseInt(hour) - firstHour;
              const top = hourIndex * GRID_CONSTANTS.HOUR_HEIGHT_PX + event.pixelPosition;

              return (
                <div
                  key={event.id}
                  className="absolute left-0 right-0 mx-2 cursor-pointer hover:shadow-md transition-shadow"
                  style={{
                    top: `${top}px`,
                    minHeight: '32px',
                  }}
                  onClick={() => onCommitClick?.(event)}
                >
                  <div className="bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-md px-2 py-1.5">
                    {/* Commit header */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <GitBranch className="w-3 h-3 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                      <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-medium">
                        {event.shortHash}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {event.branch}
                      </span>
                    </div>

                    {/* Commit message */}
                    <div className="text-[11px] text-foreground line-clamp-2 leading-tight mb-1">
                      {event.messageSubject || event.message}
                    </div>

                    {/* Repository and changes */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="truncate flex-1">{event.repository}</span>
                      {(event.insertions > 0 || event.deletions > 0) && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5">
                            <Plus className="w-2.5 h-2.5" />
                            {event.insertions}
                          </span>
                          <span className="text-red-600 dark:text-red-400 flex items-center gap-0.5">
                            <Minus className="w-2.5 h-2.5" />
                            {event.deletions}
                          </span>
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
