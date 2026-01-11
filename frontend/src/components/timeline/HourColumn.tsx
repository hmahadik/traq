import React from 'react';
import { GRID_CONSTANTS } from '@/types/timeline';

interface HourColumnProps {
  hours: number[]; // Array of hours to display (e.g., [8, 9, 10, 11])
}

export const HourColumn: React.FC<HourColumnProps> = ({ hours }) => {
  // Format hour for display (e.g., 8 -> "8 AM", 14 -> "2 PM")
  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  return (
    <div
      className="sticky left-0 z-20 bg-background border-r border-border"
      style={{ width: `${GRID_CONSTANTS.HOUR_COLUMN_WIDTH_PX}px` }}
    >
      {hours.map((hour) => (
        <div
          key={hour}
          className="relative border-b border-border/50 flex items-start justify-center pt-1"
          style={{ height: `${GRID_CONSTANTS.HOUR_HEIGHT_PX}px` }}
        >
          <span className="text-xs text-muted-foreground font-medium">
            {formatHour(hour)}
          </span>
          {/* Empty hour diagonal lines background pattern */}
          <div className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
              backgroundSize: '10px 10px'
            }}
          />
        </div>
      ))}
    </div>
  );
};
