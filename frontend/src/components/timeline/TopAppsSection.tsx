import React from 'react';
import { TopApp } from '@/types/timeline';
import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface TopAppsSectionProps {
  topApps: TopApp[];
}

// App-specific colors for the donut chart (vibrant, distinct colors)
const APP_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#84CC16', // Lime
];

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

  if (topApps.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Top Apps</div>
        <div className="text-sm text-muted-foreground">No apps tracked yet</div>
      </Card>
    );
  }

  // Calculate total duration for percentage
  const totalDuration = topApps.reduce((sum, app) => sum + app.duration, 0);

  // Prepare chart data with percentages
  const chartData = topApps.map((app, index) => ({
    name: app.appName,
    value: app.duration,
    percentage: totalDuration > 0 ? (app.duration / totalDuration) * 100 : 0,
    color: APP_COLORS[index % APP_COLORS.length],
  }));

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-3">Top Apps</div>

      {/* Donut Chart */}
      <div className="h-[140px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={55}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                      <p className="font-medium">{data.name}</p>
                      <p className="text-muted-foreground">{formatDuration(data.value)}</p>
                      <p className="text-muted-foreground">{data.percentage.toFixed(1)}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label showing total */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-lg font-bold">{formatDuration(totalDuration)}</div>
            <div className="text-[10px] text-muted-foreground">Total</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {chartData.map((app, index) => (
          <div
            key={`${app.name}-${index}`}
            className="flex items-center gap-2 text-xs"
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: app.color }}
            />
            <span className="flex-1 truncate" title={app.name}>
              {app.name}
            </span>
            <span className="text-muted-foreground flex-shrink-0">
              {formatDuration(app.value)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};
