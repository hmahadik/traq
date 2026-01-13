import React from 'react';
import { WeekSummaryStats, CATEGORY_COLORS, CATEGORY_LABELS, CategoryType } from '@/types/timeline';
import { formatDecimalHours } from '@/utils/timelineHelpers';

interface WeekSummaryCardProps {
  stats: WeekSummaryStats | null;
}

// Standard work week in hours (40 hours)
const WORK_WEEK_HOURS = 40;

export const WeekSummaryCard: React.FC<WeekSummaryCardProps> = ({ stats }) => {
  if (!stats) {
    return (
      <div className="text-center text-muted-foreground py-4">No activity this week</div>
    );
  }

  // Calculate percentage of 40-hour work week
  const workWeekPercent = Math.round((stats.totalHours / WORK_WEEK_HOURS) * 100);
  const progressBarPercent = Math.min(workWeekPercent, 100);

  // Calculate category percentages for the stacked bar
  const totalCategoryHours = Object.values(stats.categoryBreakdown).reduce((a, b) => a + b, 0);
  const categoryPercents: Record<string, number> = {};
  if (totalCategoryHours > 0) {
    for (const [cat, hours] of Object.entries(stats.categoryBreakdown)) {
      categoryPercents[cat] = (hours / totalCategoryHours) * 100;
    }
  }

  return (
    <div className="space-y-4">
      {/* Total Hours - Hero Section */}
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total This Week</div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground">
            {formatDecimalHours(stats.totalHours)}
          </span>
          <span className="text-lg text-muted-foreground">/ 40h</span>
          <span className={`text-sm font-medium ${workWeekPercent >= 100 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            ({workWeekPercent}%)
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${workWeekPercent >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
            style={{ width: `${progressBarPercent}%` }}
          />
        </div>
      </div>

      {/* Daily Average */}
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Daily Average</div>
        <div className="text-2xl font-semibold">{formatDecimalHours(stats.averageDaily)}</div>
      </div>

      {/* Most Active Day */}
      {stats.mostActiveDay && (
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Most Active</div>
          <div className="text-lg font-semibold">{stats.mostActiveDay}</div>
        </div>
      )}

      {/* Category Breakdown */}
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Category Breakdown</div>
        {/* Stacked bar */}
        <div className="flex h-2 bg-muted rounded-full overflow-hidden mb-2">
          {(['focus', 'meetings', 'comms', 'other'] as CategoryType[]).map((cat) => {
            const percent = categoryPercents[cat] || 0;
            if (percent <= 0) return null;
            return (
              <div
                key={cat}
                className={`${CATEGORY_COLORS[cat]} transition-all duration-300`}
                style={{ width: `${percent}%` }}
                title={`${CATEGORY_LABELS[cat]}: ${formatDecimalHours(stats.categoryBreakdown[cat] || 0)} (${Math.round(percent)}%)`}
              />
            );
          })}
        </div>
        {/* Legend */}
        <div className="grid grid-cols-2 gap-1">
          {(['focus', 'meetings', 'comms', 'other'] as CategoryType[]).map((cat) => {
            const hours = stats.categoryBreakdown[cat] || 0;
            if (hours <= 0) return null;
            return (
              <div key={cat} className="flex items-center gap-1.5 text-xs">
                <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[cat]}`} />
                <span className="text-muted-foreground">{CATEGORY_LABELS[cat]}:</span>
                <span className="font-medium">{formatDecimalHours(hours)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
