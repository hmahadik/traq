import { useMemo } from 'react';
import { Network, GitBranch, Terminal, FileText, Globe } from 'lucide-react';
import { ActivityCluster } from '../../types/timeline';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ClusterColumnProps {
  clusters: ActivityCluster[];
  hourHeight: number;
}

interface GroupedCluster {
  id: string;
  pixelPosition: number;
  pixelHeight: number;
  clusters: ActivityCluster[];
  totalEventCount: number;
  summaries: string[];
  gitEventIds: number[];
  shellEventIds: number[];
  fileEventIds: number[];
  browserEventIds: number[];
}

/**
 * Groups overlapping clusters into single visual blocks
 */
function groupOverlappingClusters(clusters: ActivityCluster[]): GroupedCluster[] {
  if (clusters.length === 0) return [];

  // Sort by position
  const sorted = [...clusters].sort((a, b) => a.pixelPosition - b.pixelPosition);
  const grouped: GroupedCluster[] = [];

  let currentGroup: GroupedCluster | null = null;

  for (const cluster of sorted) {
    const clusterEnd = cluster.pixelPosition + cluster.pixelHeight;

    if (!currentGroup) {
      currentGroup = {
        id: cluster.id,
        pixelPosition: cluster.pixelPosition,
        pixelHeight: cluster.pixelHeight,
        clusters: [cluster],
        totalEventCount: cluster.eventCount,
        summaries: [cluster.summary],
        gitEventIds: [...(cluster.gitEventIds || [])],
        shellEventIds: [...(cluster.shellEventIds || [])],
        fileEventIds: [...(cluster.fileEventIds || [])],
        browserEventIds: [...(cluster.browserEventIds || [])],
      };
    } else {
      const currentEnd = currentGroup.pixelPosition + currentGroup.pixelHeight;

      // Check if clusters overlap (with 5px buffer)
      if (cluster.pixelPosition <= currentEnd + 5) {
        // Merge into current group
        currentGroup.pixelHeight = Math.max(currentEnd, clusterEnd) - currentGroup.pixelPosition;
        currentGroup.clusters.push(cluster);
        currentGroup.totalEventCount += cluster.eventCount;
        currentGroup.summaries.push(cluster.summary);
        currentGroup.gitEventIds.push(...(cluster.gitEventIds || []));
        currentGroup.shellEventIds.push(...(cluster.shellEventIds || []));
        currentGroup.fileEventIds.push(...(cluster.fileEventIds || []));
        currentGroup.browserEventIds.push(...(cluster.browserEventIds || []));
      } else {
        // No overlap, save current and start new group
        grouped.push(currentGroup);
        currentGroup = {
          id: cluster.id,
          pixelPosition: cluster.pixelPosition,
          pixelHeight: cluster.pixelHeight,
          clusters: [cluster],
          totalEventCount: cluster.eventCount,
          summaries: [cluster.summary],
          gitEventIds: [...(cluster.gitEventIds || [])],
          shellEventIds: [...(cluster.shellEventIds || [])],
          fileEventIds: [...(cluster.fileEventIds || [])],
          browserEventIds: [...(cluster.browserEventIds || [])],
        };
      }
    }
  }

  if (currentGroup) {
    grouped.push(currentGroup);
  }

  return grouped;
}

export function ClusterColumn({ clusters, hourHeight }: ClusterColumnProps) {
  // Group overlapping clusters
  const groupedClusters = useMemo(() => groupOverlappingClusters(clusters), [clusters]);

  if (!clusters || clusters.length === 0) {
    return null;
  }

  return (
    <div className="relative" style={{ height: '100%' }}>
      {groupedClusters.map((group, index) => {
        const height = Math.max(group.pixelHeight, 28);

        return (
          <TooltipProvider key={group.id} delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute left-0 right-0 cursor-pointer"
                  style={{
                    top: `${group.pixelPosition}px`,
                    height: `${height}px`,
                    zIndex: index,
                  }}
                >
                  <div className="mx-1 h-full rounded-md border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition-all overflow-hidden">
                    <div className="p-1.5 h-full flex flex-col">
                      {/* Header with event count */}
                      <div className="flex items-center gap-1">
                        <Network className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-amber-900 dark:text-amber-100">
                          {group.totalEventCount}
                        </span>
                        {group.clusters.length > 1 && (
                          <span className="text-[9px] text-amber-700 dark:text-amber-300">
                            ({group.clusters.length})
                          </span>
                        )}
                      </div>
                      {/* Summary - single line truncated */}
                      {height >= 40 && (
                        <div className="text-[10px] text-amber-800 dark:text-amber-200 line-clamp-1 mt-0.5">
                          {group.summaries[0]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm p-3">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-sm">{group.totalEventCount} Related Events</span>
                    {group.clusters.length > 1 && (
                      <span className="text-xs text-muted-foreground">({group.clusters.length} clusters)</span>
                    )}
                  </div>

                  {/* Summaries */}
                  <div className="space-y-1.5">
                    {group.summaries.slice(0, 3).map((summary, idx) => (
                      <div key={idx} className="text-sm text-foreground leading-snug">
                        {summary}
                      </div>
                    ))}
                    {group.summaries.length > 3 && (
                      <div className="text-xs text-muted-foreground italic">
                        +{group.summaries.length - 3} more...
                      </div>
                    )}
                  </div>

                  {/* Event breakdown */}
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    {group.gitEventIds.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <GitBranch className="w-3 h-3 text-purple-500" />
                        <span>{group.gitEventIds.length} commit{group.gitEventIds.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {group.shellEventIds.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Terminal className="w-3 h-3 text-slate-500" />
                        <span>{group.shellEventIds.length} command{group.shellEventIds.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {group.fileEventIds.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="w-3 h-3 text-indigo-500" />
                        <span>{group.fileEventIds.length} file{group.fileEventIds.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {group.browserEventIds.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Globe className="w-3 h-3 text-cyan-500" />
                        <span>{group.browserEventIds.length} page{group.browserEventIds.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
