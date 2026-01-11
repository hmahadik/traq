import React, { useMemo } from 'react';
import { ActivityBlock as ActivityBlockType, GRID_CONSTANTS, getAppColors } from '@/types/timeline';
import { ActivityBlock } from './ActivityBlock';
import { getAppDisplayName, groupAdjacentActivities } from '@/utils/timelineHelpers';

interface AppColumnProps {
  appName: string;
  category: string;
  totalDuration: number; // seconds
  activityBlocks: ActivityBlockType[];
  hours: number[]; // Array of hours for grid alignment
}

export const AppColumn: React.FC<AppColumnProps> = ({
  appName,
  category,
  totalDuration,
  activityBlocks,
  hours,
}) => {
  // Group adjacent activities with small gaps (5 minutes or less) for cleaner display
  const groupedBlocks = useMemo(() => {
    return groupAdjacentActivities(activityBlocks, 300); // 5 minute gap threshold
  }, [activityBlocks]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get app initials
  const getAppInitials = (name: string): string => {
    const words = name.split(/[-_\s.]+/).filter(w => w.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get Timely-style colors for this app
  const colors = getAppColors(appName);
  const displayName = getAppDisplayName(appName);

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header - Timely style */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          {/* App icon */}
          <div
            className={`w-5 h-5 rounded ${colors.icon} flex items-center justify-center flex-shrink-0`}
          >
            <span className="text-[9px] font-bold text-white">
              {getAppInitials(appName)}
            </span>
          </div>
          {/* App name and duration */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate" title={appName}>
              {displayName}
            </div>
          </div>
          {/* Duration badge */}
          <div className="text-[11px] text-muted-foreground font-medium">
            {formatDuration(totalDuration)}
          </div>
        </div>
      </div>

      {/* Hour Blocks with Activity */}
      <div className="relative bg-card">
        {hours.map((hour, index) => (
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

        {/* Activity Blocks (absolutely positioned) - using grouped blocks for cleaner display */}
        <div className="absolute inset-0">
          {groupedBlocks.map((block) => (
            <ActivityBlock key={block.id} block={block} hours={hours} />
          ))}
        </div>
      </div>
    </div>
  );
};
