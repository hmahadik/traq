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
  onBlockClick?: (block: ActivityBlockType) => void;
  hourHeight?: number; // Override for effectiveHourHeight
  // Selection props
  selectedActivityIds?: Set<number>;
  onActivitySelect?: (id: number, event: React.MouseEvent) => void;
  onActivityDoubleClick?: (block: ActivityBlockType) => void;
  // Lasso preview (real-time highlighting during drag)
  lassoPreviewIds?: Set<number>;
}

export const AppColumn: React.FC<AppColumnProps> = ({
  appName,
  category,
  totalDuration,
  activityBlocks,
  hours,
  onBlockClick,
  hourHeight,
  selectedActivityIds,
  onActivitySelect,
  onActivityDoubleClick,
  lassoPreviewIds,
}) => {
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;
  // Group adjacent activities with gaps up to 15 minutes for cleaner Timely-style display
  const groupedBlocks = useMemo(() => {
    if (activityBlocks.length === 0) return [];
    const grouped = groupAdjacentActivities(activityBlocks, 900); // 15 minute gap threshold
    console.log(`[AppColumn ${appName}] ${activityBlocks.length} blocks -> ${grouped.length} grouped`);
    return grouped;
  }, [activityBlocks, appName]);

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
      {/* Column Header - Fixed height */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div
            className={`w-5 h-5 rounded ${colors.icon} flex items-center justify-center flex-shrink-0`}
          >
            <span className="text-[9px] font-bold text-white">
              {getAppInitials(appName)}
            </span>
          </div>
          <div className="flex-1 min-w-0 truncate text-xs font-medium text-foreground" title={displayName}>
            {displayName}
          </div>
          <div className="text-[10px] text-muted-foreground flex-shrink-0">
            {formatDuration(totalDuration)}
          </div>
        </div>
      </div>

      {/* Hour Blocks with Activity */}
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

        {/* Activity Blocks (absolutely positioned) - using grouped blocks for cleaner display */}
        <div className="absolute inset-0">
          {groupedBlocks.map((block) => (
            <ActivityBlock
              key={block.id}
              block={block}
              hours={hours}
              onClick={onBlockClick}
              hourHeight={effectiveHourHeight}
              isSelected={selectedActivityIds?.has(block.id)}
              isLassoPreview={lassoPreviewIds?.has(block.id)}
              onSelect={onActivitySelect}
              onDoubleClick={onActivityDoubleClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
