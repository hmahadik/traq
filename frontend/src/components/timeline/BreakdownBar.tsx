import React from 'react';
import { DayStats, CATEGORY_LABELS } from '@/types/timeline';
import { Card } from '@/components/ui/card';

interface BreakdownBarProps {
  stats: DayStats | null;
}

export const BreakdownBar: React.FC<BreakdownBarProps> = ({ stats }) => {
  if (!stats || stats.totalSeconds === 0) {
    return (
      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Time Breakdown</div>
        <div className="text-sm text-muted-foreground">No activity to display</div>
      </Card>
    );
  }

  const { breakdown, breakdownPercent } = stats;

  // Category colors
  const categoryColors = {
    focus: 'bg-green-500',
    meetings: 'bg-red-500',
    comms: 'bg-purple-500',
    other: 'bg-gray-500',
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

  // Get categories with data
  const categories = ['focus', 'meetings', 'comms', 'other'].filter(
    (cat) => breakdown[cat] && breakdown[cat] > 0
  );

  if (categories.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Time Breakdown</div>
        <div className="text-sm text-muted-foreground">No categorized activity</div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-3">Time Breakdown</div>

      {/* Stacked Bar */}
      <div className="h-8 w-full flex rounded-lg overflow-hidden mb-4 shadow-sm">
        {categories.map((category) => {
          const percentage = breakdownPercent[category] || 0;
          const colorClass =
            categoryColors[category as keyof typeof categoryColors] || categoryColors.other;

          return (
            <div
              key={category}
              className={`${colorClass} transition-all hover:brightness-110`}
              style={{ width: `${percentage}%` }}
              title={`${CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}: ${percentage.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {categories.map((category) => {
          const seconds = breakdown[category] || 0;
          const percentage = breakdownPercent[category] || 0;
          const colorClass =
            categoryColors[category as keyof typeof categoryColors] || categoryColors.other;

          return (
            <div key={category} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${colorClass}`} />
                <span className="text-muted-foreground">
                  {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatDuration(seconds)}</span>
                <span className="text-xs text-muted-foreground">({percentage.toFixed(0)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
