import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle } from 'lucide-react';
import { GRID_CONSTANTS } from '@/types/timeline';

interface EntryBlockData {
  id: number;
  eventType: string;
  projectId: number;
  projectName: string;
  projectColor: string;
  appName: string;
  windowTitle: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  confidence: number;
  source: string;
}

interface EntryBlockProps {
  entry: EntryBlockData;
  hourHeight: number;
  onClick?: (entry: EntryBlockData) => void;
  onContextMenu?: (entry: EntryBlockData, e: React.MouseEvent) => void;
}

export const EntryBlock: React.FC<EntryBlockProps> = ({
  entry,
  hourHeight,
  onClick,
  onContextMenu,
}) => {
  // Calculate position based on time
  const startDate = new Date(entry.startTime * 1000);
  const startHour = startDate.getHours();
  const startMinute = startDate.getMinutes();

  // Position from top of grid (after 44px header)
  const headerHeight = 44;
  const topPosition = headerHeight + (startHour * hourHeight) + (startMinute / 60 * hourHeight);

  // Height based on duration
  const heightPx = Math.max(
    GRID_CONSTANTS.MIN_BLOCK_HEIGHT_PX,
    (entry.durationSeconds / 3600) * hourHeight
  );

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const isAutoAssigned = entry.source === 'rule' || entry.source === 'ai';
  const isLowConfidence = isAutoAssigned && entry.confidence < 0.8;

  return (
    <div
      className={cn(
        'absolute left-1 right-1 rounded px-1.5 py-0.5 cursor-pointer',
        'border-l-4 hover:ring-2 hover:ring-primary/50',
        'overflow-hidden text-xs'
      )}
      style={{
        top: `${topPosition}px`,
        height: `${heightPx}px`,
        backgroundColor: `${entry.projectColor}20`,
        borderLeftColor: entry.projectColor,
      }}
      onClick={() => onClick?.(entry)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(entry, e);
      }}
      data-entry-id={entry.id}
      data-event-type={entry.eventType}
    >
      <div className="flex items-center gap-1 min-w-0">
        {isLowConfidence && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
            </TooltipTrigger>
            <TooltipContent>
              Auto-assigned ({Math.round(entry.confidence * 100)}% confidence)
            </TooltipContent>
          </Tooltip>
        )}
        <span className="font-medium truncate" style={{ color: entry.projectColor }}>
          {entry.projectName}
        </span>
      </div>
      {heightPx > 24 && (
        <div className="text-muted-foreground truncate">
          {entry.appName}
        </div>
      )}
      {heightPx > 36 && (
        <div className="text-muted-foreground/70 truncate text-[10px]">
          {formatDuration(entry.durationSeconds)}
        </div>
      )}
    </div>
  );
};
