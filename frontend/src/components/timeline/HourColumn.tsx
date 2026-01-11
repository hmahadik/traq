import React from 'react';
import { Clock } from 'lucide-react';
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
      className="sticky left-0 z-20 bg-muted border-r border-border"
      style={{ width: `${GRID_CONSTANTS.HOUR_COLUMN_WIDTH_PX}px` }}
    >
      {/* Header - matches other column headers with icon */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 py-2.5">
        <div className="flex items-center justify-center gap-1">
          <div className="w-5 h-5 rounded bg-slate-500 flex items-center justify-center">
            <Clock className="w-3 h-3 text-white" />
          </div>
        </div>
      </div>

      {/* Hour labels */}
      {hours.map((hour) => (
        <div
          key={hour}
          className="relative border-b border-border flex items-start justify-end pr-2 pt-1"
          style={{ height: `${GRID_CONSTANTS.HOUR_HEIGHT_PX}px` }}
        >
          <span className="text-[11px] text-muted-foreground font-medium">
            {formatHour(hour)}
          </span>
        </div>
      ))}
    </div>
  );
};
