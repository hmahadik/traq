import React from 'react';
import { DayStats } from '@/types/timeline';

interface DailySummaryCardProps {
  stats: DayStats | null;
}

// Standard workday in seconds (8 hours)
const WORKDAY_SECONDS = 8 * 60 * 60;

export const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ stats }) => {
  if (!stats) {
    return (
      <div className="text-center text-muted-foreground py-4">No activity today</div>
    );
  }

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

  // Calculate percentage of 8-hour workday (can be over 100%)
  const workdayPercent = Math.round((stats.totalSeconds / WORKDAY_SECONDS) * 100);
  // For progress bar, cap at 100%
  const progressBarPercent = Math.min(workdayPercent, 100);

  return (
    <div className="space-y-4">
      {/* Hours Worked - Hero Section */}
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Hours Worked</div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            {formatDuration(stats.totalSeconds)}
          </span>
          <span className="text-lg text-muted-foreground">/ 8h</span>
          <span className={`text-sm font-medium ${workdayPercent >= 100 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            ({workdayPercent}%)
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${workdayPercent >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-primary via-purple-500 to-pink-500'}`}
            style={{ width: `${progressBarPercent}%` }}
          />
        </div>
      </div>

      {/* Start & End Time */}
      {stats.daySpan && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Start Time</div>
            <div className="text-lg font-semibold">{formatTime(stats.daySpan.startTime)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">End Time</div>
            <div className="text-lg font-semibold">{formatTime(stats.daySpan.endTime)}</div>
          </div>
        </div>
      )}

      {/* Breaks & Longest Focus - Grid layout, no card styling */}
      <div className="grid grid-cols-2 gap-4">
        {/* Breaks */}
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Breaks</div>
          <div className="text-lg font-semibold">{formatDuration(stats.breakDuration)}</div>
          <div className="text-xs text-muted-foreground">{stats.breakCount} break{stats.breakCount !== 1 ? 's' : ''}</div>
        </div>

        {/* Longest Focus */}
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Longest Focus</div>
          <div className="text-lg font-semibold">{formatDuration(stats.longestFocus)}</div>
        </div>
      </div>
    </div>
  );
};
