import React from 'react';
import { DayStats } from '@/types/timeline';

interface BreakdownBarProps {
  stats: DayStats | null;
}

export const BreakdownBar: React.FC<BreakdownBarProps> = ({ stats }) => {
  if (!stats || stats.totalSeconds === 0) {
    return null;
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

  // Calculate values
  const meetingSeconds = stats.breakdown?.meetings || 0;
  const activeSeconds = stats.totalSeconds - meetingSeconds; // Active = total minus meetings
  const breakSeconds = stats.breakDuration || 0;

  // Total for percentage calculation (active + breaks + meetings)
  const totalSeconds = stats.totalSeconds + breakSeconds;

  if (totalSeconds === 0) return null;

  // Calculate percentages
  const activePercent = (activeSeconds / totalSeconds) * 100;
  const meetingsPercent = (meetingSeconds / totalSeconds) * 100;
  const breaksPercent = (breakSeconds / totalSeconds) * 100;

  // Categories with their values
  const categories = [
    { key: 'active', label: 'Active', seconds: activeSeconds, percent: activePercent, color: 'bg-emerald-500' },
    { key: 'meetings', label: 'Meetings', seconds: meetingSeconds, percent: meetingsPercent, color: 'bg-blue-500' },
    { key: 'breaks', label: 'Breaks', seconds: breakSeconds, percent: breaksPercent, color: 'bg-orange-500' },
  ].filter(cat => cat.seconds > 0);

  if (categories.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">Time Breakdown</div>

      {/* Slim stacked bar */}
      <div className="flex h-2 bg-muted rounded-full overflow-hidden">
        {categories.map((cat) => (
          <div
            key={cat.key}
            className={`${cat.color} transition-all duration-300`}
            style={{ width: `${cat.percent}%` }}
            title={`${cat.label}: ${formatDuration(cat.seconds)} (${cat.percent.toFixed(0)}%)`}
          />
        ))}
      </div>

      {/* Legend - inline */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {categories.map((cat) => (
          <div key={cat.key} className="flex items-center gap-1.5 text-xs">
            <div className={`w-2 h-2 rounded-full ${cat.color}`} />
            <span className="text-muted-foreground">{cat.label}</span>
            <span className="font-medium">{formatDuration(cat.seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
