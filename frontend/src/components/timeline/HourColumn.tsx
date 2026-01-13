import React from 'react';
import { Clock } from 'lucide-react';
import { GRID_CONSTANTS } from '@/types/timeline';

interface HourColumnProps {
  hours: number[]; // Array of hours to display (e.g., [8, 9, 10, 11])
  hourHeight?: number; // Override for effectiveHourHeight
}

export const HourColumn: React.FC<HourColumnProps> = ({ hours, hourHeight }) => {
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;
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
      {/* Header - Fixed height */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center justify-center">
        <div className="w-5 h-5 rounded bg-slate-500 flex items-center justify-center">
          <Clock className="w-3 h-3 text-white" />
        </div>
      </div>

      {/* Hour labels with quarter-hour markers */}
      {hours.map((hour, index) => (
        <div
          key={hour}
          className={`relative border-b border-border ${
            index % 2 === 0 ? 'bg-muted' : 'bg-muted/50'
          }`}
          style={{ height: `${effectiveHourHeight}px` }}
        >
          {/* Hour label - positioned to align with the hour start line */}
          <div className="absolute -top-3 right-2 bg-muted px-1 z-10">
            <span className="text-xs font-semibold text-foreground/80">
              {formatHour(hour)}
            </span>
          </div>

          {/* Quarter-hour tick marks */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-border/40"
            style={{ top: `${effectiveHourHeight * 0.25}px` }}
          />
          <div
            className="absolute left-0 right-0 border-t border-border/50"
            style={{ top: `${effectiveHourHeight * 0.5}px` }}
          >
            {/* Half-hour label */}
            <span className="absolute right-2 -top-2 text-[10px] text-muted-foreground/60">
              :30
            </span>
          </div>
          <div
            className="absolute left-0 right-0 border-t border-dashed border-border/40"
            style={{ top: `${effectiveHourHeight * 0.75}px` }}
          />
        </div>
      ))}
    </div>
  );
};
