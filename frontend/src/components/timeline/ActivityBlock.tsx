import React from 'react';
import { ActivityBlock as ActivityBlockType, CATEGORY_COLORS, GRID_CONSTANTS } from '@/types/timeline';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActivityBlockProps {
  block: ActivityBlockType;
}

export const ActivityBlock: React.FC<ActivityBlockProps> = ({ block }) => {
  const { pixelPosition, pixelHeight, windowTitle, category, durationSeconds, startTime } = block;

  // Ensure minimum height for visibility
  const actualHeight = Math.max(pixelHeight, GRID_CONSTANTS.MIN_BLOCK_HEIGHT_PX);

  // Category color mapping with gradient
  const categoryColorMap = {
    focus: 'from-green-500 to-green-600',
    meetings: 'from-red-500 to-red-600',
    comms: 'from-purple-500 to-purple-600',
    other: 'from-gray-500 to-gray-600',
  };

  const gradientClass = categoryColorMap[category as keyof typeof categoryColorMap] || categoryColorMap.other;

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`absolute left-0 right-0 mx-1 rounded bg-gradient-to-b ${gradientClass} opacity-90 hover:opacity-100 transition-opacity cursor-pointer shadow-sm`}
            style={{
              top: `${pixelPosition}px`,
              height: `${actualHeight}px`,
            }}
          />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{windowTitle}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatTime(startTime)}</span>
              <span>•</span>
              <span>{formatDuration(durationSeconds)}</span>
            </div>
            <div className="text-xs text-muted-foreground capitalize">{category}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
