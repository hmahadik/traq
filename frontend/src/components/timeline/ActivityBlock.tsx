import React from 'react';
import { ActivityBlock as ActivityBlockType, GRID_CONSTANTS, getAppColors } from '@/types/timeline';
import { getAppDisplayName } from '@/utils/timelineHelpers';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActivityBlockProps {
  block: ActivityBlockType;
  hours: number[]; // Array of displayed hours for position calculation
  onClick?: (block: ActivityBlockType) => void;
}

export const ActivityBlock: React.FC<ActivityBlockProps> = ({ block, hours, onClick }) => {
  const { pixelPosition, pixelHeight, windowTitle, appName, durationSeconds, startTime, hourOffset } = block;

  // Calculate absolute position: which row + position within that row
  // Scale pixel position to new hour height (data uses 60px base, we use 80px)
  const hourIndex = hours.indexOf(hourOffset);
  const scaledPixelPosition = (pixelPosition / 60) * GRID_CONSTANTS.HOUR_HEIGHT_PX;
  const scaledPixelHeight = (pixelHeight / 60) * GRID_CONSTANTS.HOUR_HEIGHT_PX;
  const absoluteTop = hourIndex >= 0
    ? (hourIndex * GRID_CONSTANTS.HOUR_HEIGHT_PX) + scaledPixelPosition
    : scaledPixelPosition;

  // Ensure minimum height for visibility
  const actualHeight = Math.max(scaledPixelHeight, GRID_CONSTANTS.MIN_BLOCK_HEIGHT_PX);

  // Get Timely-style colors for this app
  const colors = getAppColors(appName);

  // Get app initials (first 2 letters)
  const getAppInitials = (name: string): string => {
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

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

  // Determine what to show based on block height
  const showDuration = actualHeight >= 24;
  const showIcon = actualHeight >= 16;

  // Use more rounded corners for pill-like appearance
  // Very small blocks get full rounding, larger blocks get moderate rounding
  const roundedClass = actualHeight <= 16 ? 'rounded-full' : 'rounded-lg';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`absolute left-1 right-1 ${roundedClass} ${colors.bg} hover:shadow-md transition-all cursor-pointer overflow-hidden border border-black/5 dark:border-white/10`}
            style={{
              top: `${absoluteTop}px`,
              height: `${actualHeight}px`,
            }}
            onClick={() => onClick?.(block)}
            role="button"
            aria-label={`${getAppDisplayName(appName)} activity from ${formatTime(startTime)} for ${formatDuration(durationSeconds)}`}
          >
            {showIcon && (
              <div className="flex items-start gap-1.5 p-1.5">
                {/* App icon */}
                <div
                  className={`w-4 h-4 rounded ${colors.icon} flex items-center justify-center flex-shrink-0`}
                >
                  <span className="text-[8px] font-bold text-white">
                    {getAppInitials(appName)}
                  </span>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className={`text-[11px] font-medium ${colors.text} truncate leading-tight`}>
                    {getAppDisplayName(appName)}
                  </div>
                  {showDuration && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDuration(durationSeconds)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded ${colors.icon} flex items-center justify-center`}>
                <span className="text-[10px] font-bold text-white">
                  {getAppInitials(appName)}
                </span>
              </div>
              <span className="font-semibold">{getAppDisplayName(appName)}</span>
            </div>
            <p className="text-sm text-muted-foreground truncate">{windowTitle}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatTime(startTime)}</span>
              <span>-</span>
              <span>{formatDuration(durationSeconds)}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
