import React from 'react';
import { Coffee } from 'lucide-react';
import { AFKBlock, GRID_CONSTANTS } from '@/types/timeline';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AFKColumnProps {
  afkBlocks: Record<number, AFKBlock[]>;
  hours: number[];
  hourHeight?: number;
}

// Header height for column headers (matches the header in HourColumn/AppColumn)
const HEADER_HEIGHT_PX = 44;

export const AFKColumn: React.FC<AFKColumnProps> = ({ afkBlocks, hours, hourHeight }) => {
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${Math.floor(seconds)}s`;
  };

  // Format time
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get friendly trigger type label
  const getTriggerLabel = (triggerType: string): string => {
    switch (triggerType) {
      case 'idle_timeout':
        return 'Idle';
      case 'system_sleep':
        return 'Sleep';
      case 'manual':
        return 'Manual';
      default:
        return 'AFK';
    }
  };

  return (
    <div className="relative border-r border-border" style={{ minWidth: '80px' }}>
      {/* Column header - Fixed height */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="w-5 h-5 rounded bg-slate-400 flex items-center justify-center flex-shrink-0">
            <Coffee className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-medium text-foreground truncate">AFK</span>
        </div>
      </div>

      {/* Hour blocks */}
      {hours.map((hour, index) => {
        const blocks = afkBlocks[hour] || [];
        return (
          <div
            key={hour}
            className={`relative border-b border-gray-100 dark:border-gray-800 ${
              index % 2 === 0 ? 'bg-card' : 'bg-muted/30'
            }`}
            style={{ height: `${effectiveHourHeight}px` }}
          >
            {blocks.map((block) => {
              // Calculate absolute position within this hour block
              const hourIndex = hours.indexOf(block.hourOffset);
              const scaledPixelPosition = (block.pixelPosition / 60) * effectiveHourHeight;
              const scaledPixelHeight = (block.durationSeconds / 3600) * effectiveHourHeight;

              // For blocks that start in previous hours, only render if this is the correct hour
              if (hourIndex !== index) {
                return null;
              }

              // Ensure minimum height for visibility
              const actualHeight = Math.max(scaledPixelHeight, GRID_CONSTANTS.MIN_BLOCK_HEIGHT_PX);

              return (
                <TooltipProvider key={block.id} delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute left-1 right-1 rounded-lg cursor-help overflow-hidden border border-slate-300 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm hover:shadow-md transition-all"
                        style={{
                          top: `${scaledPixelPosition}px`,
                          height: `${actualHeight}px`,
                        }}
                        role="button"
                        aria-label={`AFK period: ${getTriggerLabel(block.triggerType)} from ${formatTime(block.startTime)} for ${formatDuration(block.durationSeconds)}`}
                      >
                        {/* AFK indicator - only show icon if block is tall enough */}
                        {actualHeight >= 18 && (
                          <div className="flex items-center justify-center h-full">
                            <Coffee className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-sm p-3">
                      <div className="space-y-2">
                        {/* Header */}
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-slate-400 flex items-center justify-center">
                            <Coffee className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="font-semibold text-sm">Away From Keyboard</span>
                        </div>

                        {/* Trigger type */}
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Type: </span>
                          {getTriggerLabel(block.triggerType)}
                        </div>

                        {/* Time info */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatTime(block.startTime)}</span>
                          <span>•</span>
                          <span>{formatDuration(block.durationSeconds)}</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
