import React, { useMemo } from 'react';
import { GitBranch, Plus, Minus, Copy, Clock, FileText, FolderGit } from 'lucide-react';
import { GRID_CONSTANTS, GitEventDisplay } from '@/types/timeline';
import { groupGitEvents, GroupedGitEvent } from '@/utils/timelineHelpers';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GitColumnProps {
  gitEvents: { [hour: number]: GitEventDisplay[] };
  hours: number[];
  onCommitClick?: (event: GitEventDisplay) => void;
  hourHeight?: number;
  lassoPreviewKeys?: Set<string>;
  selectedEventKeys?: Set<string>;
}

export const GitColumn: React.FC<GitColumnProps> = ({
  gitEvents,
  hours,
  onCommitClick,
  hourHeight,
  lassoPreviewKeys,
  selectedEventKeys,
}) => {
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;

  // Flatten and group all git events by time proximity
  const groupedEvents = useMemo(() => {
    const allEvents: GitEventDisplay[] = [];
    Object.values(gitEvents).forEach(events => {
      allEvents.push(...events);
    });
    const grouped = groupGitEvents(allEvents, 900); // 15 min gap threshold
    console.log(`[GitColumn] ${allEvents.length} events -> ${grouped.length} grouped`);
    return grouped;
  }, [gitEvents]);

  // Calculate total commits for the day
  const totalCommits = Object.values(gitEvents).reduce((sum, events) => sum + events.length, 0);

  // Format time for display
  const formatTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Copy hash to clipboard
  const copyHash = (e: React.MouseEvent, hash: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
  };

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="w-5 h-5 rounded bg-purple-500 flex items-center justify-center flex-shrink-0">
            <GitBranch className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1 min-w-0 truncate text-xs font-medium text-foreground">Git</div>
          <div className="text-[10px] text-muted-foreground flex-shrink-0">{totalCommits}</div>
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

        {/* Grouped Git Event Blocks (absolutely positioned) */}
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
            const height = Math.max(36, durationHours * effectiveHourHeight);

            // Check if any event in this group is in the lasso preview or selected
            const isHighlighted = group.events.some(e => {
              const key = `git:${e.id}`;
              return lassoPreviewKeys?.has(key) || selectedEventKeys?.has(key);
            });

            return (
              <TooltipProvider key={group.id} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`absolute left-0 right-0 mx-1 cursor-pointer hover:shadow-md transition-shadow ${
                        isHighlighted ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                      }`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                      }}
                      data-event-keys={JSON.stringify(group.events.map(e => `git:${e.id}`))}
                      onClick={() => onCommitClick?.(group.events[0] as unknown as GitEventDisplay)}
                    >
                      <div className="bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-md px-2 py-1 h-full overflow-hidden">
                        {/* Header with count */}
                        <div className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                          <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-medium truncate flex-1">
                            {group.mergedCount > 1
                              ? `${group.mergedCount} commits`
                              : group.shortHash}
                          </span>
                        </div>
                        {/* Message - only show if single commit and tall enough */}
                        {group.mergedCount === 1 && height >= 48 && (
                          <div className="text-[10px] text-foreground line-clamp-1 leading-tight mt-0.5">
                            {group.messageSubject || group.message}
                          </div>
                        )}
                        {/* Stats for merged */}
                        {group.mergedCount > 1 && height >= 48 && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-[9px]">
                            <span className="text-green-600 dark:text-green-400">+{group.totalInsertions}</span>
                            <span className="text-red-600 dark:text-red-400">-{group.totalDeletions}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-sm p-3">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-purple-500" />
                        <span className="font-semibold text-sm">
                          {group.mergedCount > 1
                            ? `${group.mergedCount} Commits`
                            : group.shortHash}
                        </span>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(group.startTimestamp)}
                        </span>
                        {group.repositories.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <FolderGit className="w-3 h-3" />
                              {group.repositories.length === 1
                                ? group.repository
                                : `${group.repositories.length} repos`}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Branches */}
                      {group.branches.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {group.branches.slice(0, 4).map((branch, idx) => (
                            <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
                              {branch}
                            </span>
                          ))}
                          {group.branches.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{group.branches.length - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Changes summary */}
                      {(group.totalInsertions > 0 || group.totalDeletions > 0) && (
                        <div className="flex items-center gap-3 pt-2 border-t border-border">
                          <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-sm font-medium">
                            <Plus className="w-3.5 h-3.5" />
                            {group.totalInsertions}
                          </span>
                          <span className="text-red-600 dark:text-red-400 flex items-center gap-1 text-sm font-medium">
                            <Minus className="w-3.5 h-3.5" />
                            {group.totalDeletions}
                          </span>
                        </div>
                      )}

                      {/* Commit list */}
                      {group.events.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-border">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                            Commits
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {group.events.slice(0, 6).map((commit) => (
                              <div key={commit.id} className="flex items-start gap-1.5">
                                <button
                                  onClick={(e) => copyHash(e, commit.shortHash)}
                                  className="text-[10px] font-mono text-purple-600 dark:text-purple-400 hover:underline flex-shrink-0"
                                  title="Copy hash"
                                >
                                  {commit.shortHash}
                                </button>
                                <span className="text-[11px] text-foreground/80 leading-tight truncate">
                                  {commit.messageSubject || commit.message}
                                </span>
                              </div>
                            ))}
                            {group.events.length > 6 && (
                              <div className="text-[10px] text-muted-foreground/70 italic">
                                +{group.events.length - 6} more...
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
