import React from 'react';
import { DayStats } from '@/types/timeline';
import { Card } from '@/components/ui/card';

interface DailySummaryCardProps {
  stats: DayStats | null;
}

export const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ stats }) => {
  if (!stats) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">No activity today</div>
      </Card>
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

  return (
    <Card className="p-6">
      {/* Hero Section */}
      <div className="mb-6">
        <div className="text-sm text-muted-foreground mb-2">⏱️ Hours Worked</div>
        <div className="text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
          {stats.totalHours.toFixed(1)}h
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {Math.floor(stats.totalSeconds / 60)} minutes total
        </div>
      </div>

      {/* Stats Grid */}
      <div className="space-y-3">
        {/* Day Span */}
        {stats.daySpan && (
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">📅 Day Span</span>
            <span className="text-sm font-medium">
              {formatTime(stats.daySpan.startTime)} - {formatTime(stats.daySpan.endTime)}
            </span>
          </div>
        )}

        {/* Breaks */}
        <div className="flex items-center justify-between py-2 border-b border-border/50">
          <span className="text-sm text-muted-foreground">☕ Breaks</span>
          <span className="text-sm font-medium">
            {stats.breakCount} breaks ({formatDuration(stats.breakDuration)})
          </span>
        </div>

        {/* Longest Focus */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">🎯 Longest Focus</span>
          <span className="text-sm font-medium">{formatDuration(stats.longestFocus)}</span>
        </div>
      </div>
    </Card>
  );
};
