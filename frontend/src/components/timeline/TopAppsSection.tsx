import React from 'react';
import { TopApp } from '@/types/timeline';
import { Card } from '@/components/ui/card';

interface TopAppsSectionProps {
  topApps: TopApp[];
}

export const TopAppsSection: React.FC<TopAppsSectionProps> = ({ topApps }) => {
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
  const getAppIcon = (appName: string): string => {
    return appName.substring(0, 2).toUpperCase();
  };

  // Category colors for icon background
  const categoryColors = {
    focus: 'bg-green-500/10 text-green-600',
    meetings: 'bg-red-500/10 text-red-600',
    comms: 'bg-purple-500/10 text-purple-600',
    other: 'bg-gray-500/10 text-gray-600',
  };

  if (topApps.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">📊 Top Apps</div>
        <div className="text-sm text-muted-foreground">No apps tracked yet</div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-3">📊 Top Apps</div>
      <div className="space-y-2">
        {topApps.map((app, index) => {
          const colorClass =
            categoryColors[app.category as keyof typeof categoryColors] || categoryColors.other;

          return (
            <div
              key={`${app.appName}-${index}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className={`w-10 h-10 rounded ${colorClass} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                {getAppIcon(app.appName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" title={app.appName}>
                  {app.appName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDuration(app.duration)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex-shrink-0">#{index + 1}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
