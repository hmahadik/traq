import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AppUsage } from '@/types/analytics';

interface TimeDistributionChartProps {
  data: AppUsage[] | undefined;
  isLoading: boolean;
  onAppClick?: (appName: string) => void;
}

// Color palette for pie chart slices
// Using distinct, accessible colors for better visibility
const COLORS = [
  'hsl(217, 91%, 60%)', // Blue
  'hsl(142, 76%, 36%)', // Green
  'hsl(24, 95%, 53%)',  // Orange
  'hsl(262, 83%, 58%)', // Purple
  'hsl(346, 87%, 43%)', // Red
  'hsl(186, 100%, 42%)', // Cyan
  'hsl(43, 96%, 56%)',  // Yellow
  'hsl(320, 66%, 52%)', // Pink
  'hsl(20, 79%, 45%)',  // Brown
  'hsl(163, 72%, 48%)', // Teal
];

// Format seconds to human-readable duration
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  }
  return '< 1m';
};

export function TimeDistributionChart({ data, isLoading, onAppClick }: TimeDistributionChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[350px] items-center justify-center text-muted-foreground">
            No app usage data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort by duration descending and take top 10
  const chartData = [...data]
    .sort((a, b) => b.durationSeconds - a.durationSeconds)
    .slice(0, 10)
    .map((app, index) => ({
      ...app,
      name: app.appName,
      value: app.durationSeconds,
      color: COLORS[index % COLORS.length],
      durationLabel: formatDuration(app.durationSeconds),
    }));

  // Custom label renderer for pie slices
  const renderLabel = (entry: any) => {
    // Only show label if percentage is > 5% to avoid clutter
    if (entry.percentage < 5) {
      return '';
    }
    return `${entry.percentage.toFixed(1)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time Distribution</CardTitle>
        <p className="text-sm text-muted-foreground">
          App usage breakdown by time spent
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
              onClick={(data) => {
                if (onAppClick) {
                  onAppClick(data.appName);
                }
              }}
              style={{ cursor: onAppClick ? 'pointer' : 'default' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              formatter={(value: number, name: string, props: any) => {
                const { durationLabel, percentage } = props.payload;
                return [`${durationLabel} (${percentage.toFixed(1)}%)`, props.payload.appName];
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value, entry: any) => {
                const payload = entry.payload as any;
                return `${payload.appName} (${payload.percentage.toFixed(1)}%)`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
