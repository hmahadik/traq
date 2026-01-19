import React from 'react';
import { ActivityBlock as ActivityBlockType, GRID_CONSTANTS, getAppColors } from '@/types/timeline';
import { getAppDisplayName } from '@/utils/timelineHelpers';
import { Clock, Monitor, Image, AlertCircle } from 'lucide-react';
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
  hourHeight?: number;
  // Selection props
  isSelected?: boolean;
  isLassoPreview?: boolean; // Real-time lasso selection preview
  onSelect?: (id: number, event: React.MouseEvent) => void;
  onDoubleClick?: (block: ActivityBlockType) => void;
}

export const ActivityBlock: React.FC<ActivityBlockProps> = ({
  block,
  hours,
  onClick,
  hourHeight,
  isSelected = false,
  isLassoPreview = false,
  onSelect,
  onDoubleClick,
}) => {
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;
  const { pixelPosition, windowTitle, appName, durationSeconds, startTime, hourOffset } = block;

  // Calculate absolute position: which row + position within that row
  // Scale pixel position to new hour height (data uses 60px base)
  const hourIndex = hours.indexOf(hourOffset);
  const scaledPixelPosition = (pixelPosition / 60) * effectiveHourHeight;
  // Calculate height from duration (more accurate for grouped blocks)
  const scaledPixelHeight = (durationSeconds / 3600) * effectiveHourHeight;
  const absoluteTop = hourIndex >= 0
    ? (hourIndex * effectiveHourHeight) + scaledPixelPosition
    : scaledPixelPosition;

  // Ensure minimum height for visibility
  const actualHeight = Math.max(scaledPixelHeight, GRID_CONSTANTS.MIN_BLOCK_HEIGHT_PX);

  // Get Timely-style colors for this app
  const colors = getAppColors(appName);

  // Project assignment status
  const isAssigned = block.projectId != null && block.projectId > 0;
  const isAutoAssigned = block.projectSource === 'rule' || block.projectSource === 'ai';
  const isLowConfidence = isAutoAssigned && (block.projectConfidence || 0) < 0.8;

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
  const showDuration = actualHeight >= 28;
  const showIcon = actualHeight >= 18;

  // Use more rounded corners for pill-like appearance
  // Very small blocks get full rounding, larger blocks get moderate rounding
  const roundedClass = actualHeight <= 16 ? 'rounded-full' : 'rounded-lg';

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`absolute left-1 right-1 ${roundedClass} ${colors.bg} hover:shadow-md transition-all cursor-pointer overflow-hidden border ${
              isSelected
                ? 'ring-2 ring-blue-500 ring-offset-1 border-blue-500'
                : isLassoPreview
                ? 'ring-2 ring-blue-400/60 ring-offset-1 border-blue-400 bg-blue-500/10'
                : 'border-black/5 dark:border-white/10'
            } ${
              isAssigned
                ? 'border-l-4'
                : 'opacity-70 border-l-2 border-l-dashed border-l-gray-400 dark:border-l-gray-500'
            }`}
            style={{
              top: `${absoluteTop}px`,
              height: `${actualHeight}px`,
              borderLeftColor: isAssigned ? block.projectColor : undefined,
            }}
            data-activity-id={block.id}
            data-event-key={`activity:${block.id}`}
            onClick={(e) => {
              if (onSelect) {
                onSelect(block.id, e);
              } else {
                onClick?.(block);
              }
            }}
            onDoubleClick={() => onDoubleClick?.(block)}
            role="button"
            aria-label={`${getAppDisplayName(appName)} activity from ${formatTime(startTime)} for ${formatDuration(durationSeconds)}`}
            aria-selected={isSelected}
          >
            {showIcon && (
              <div className="flex items-start gap-2 p-2">
                {/* App icon */}
                <div
                  className={`w-5 h-5 rounded ${colors.icon} flex items-center justify-center flex-shrink-0`}
                >
                  <span className="text-[9px] font-bold text-white">
                    {getAppInitials(appName)}
                  </span>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className={`text-xs font-medium ${colors.text} truncate leading-tight`}>
                    {getAppDisplayName(appName)}
                  </div>
                  {showDuration && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDuration(durationSeconds)}
                    </div>
                  )}
                </div>
                {/* Low confidence indicator for auto-assigned projects */}
                {isLowConfidence && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-shrink-0">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <span>Auto-assigned ({Math.round((block.projectConfidence || 0) * 100)}% confidence)</span>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-sm p-3">
          <div className="space-y-3">
            {/* Header with app icon and name */}
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded ${colors.icon} flex items-center justify-center`}>
                <span className="text-[10px] font-bold text-white">
                  {getAppInitials(appName)}
                </span>
              </div>
              <span className="font-semibold text-sm">{getAppDisplayName(appName)}</span>
            </div>

            {/* Full window title */}
            <div className="flex items-start gap-2">
              <Monitor className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-sm text-foreground leading-snug">{windowTitle}</span>
            </div>

            {/* Time info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(startTime)}
              </span>
              <span>•</span>
              <span>{formatDuration(durationSeconds)}</span>
            </div>

            {/* Hint for clicking */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                <Image className="w-3 h-3" />
                <span>Click to view screenshots from this time</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
