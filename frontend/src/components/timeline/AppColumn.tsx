import React from 'react';
import { ActivityBlock as ActivityBlockType, GRID_CONSTANTS } from '@/types/timeline';
import { ActivityBlock } from './ActivityBlock';

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
  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get app icon (first 2 letters uppercase)
  const getAppIcon = (name: string): string => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border p-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {getAppIcon(appName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" title={appName}>
              {appName}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {formatDuration(totalDuration)}
            </div>
          </div>
        </div>
      </div>

      {/* Hour Blocks with Activity */}
      <div className="relative">
        {hours.map((hour) => (
          <div
            key={hour}
            className="relative border-b border-border/30"
            style={{ height: `${GRID_CONSTANTS.HOUR_HEIGHT_PX}px` }}
          >
            {/* Empty state diagonal pattern */}
            <div
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
                backgroundSize: '10px 10px',
              }}
            />
          </div>
        ))}

        {/* Activity Blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {activityBlocks.map((block) => (
            <ActivityBlock key={block.id} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
};
