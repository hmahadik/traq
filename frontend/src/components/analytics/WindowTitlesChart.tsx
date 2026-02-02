import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/constants';
import type { WindowUsage } from '@/types';

interface WindowTitlesChartProps {
  data: WindowUsage[] | undefined;
  isLoading: boolean;
}

function truncateTitle(title: string, maxLength: number = 25): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength - 1) + '\u2026';
}

export function WindowTitlesChart({ data, isLoading }: WindowTitlesChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Windows</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Windows</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No window data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((window) => ({
    name: window.windowTitle,
    shortName: truncateTitle(window.windowTitle),
    appName: window.appName,
    value: window.durationSeconds,
    percentage: window.percentage,
    focusCount: window.focusCount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Windows</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              label={({ shortName, percentage, cx, cy, midAngle, outerRadius, x, y }) => {
                if (percentage < 8) return null;
                const RADIAN = Math.PI / 180;
                const sin = Math.sin(-RADIAN * midAngle);
                const cos = Math.cos(-RADIAN * midAngle);
                const textAnchor = cos >= 0 ? 'start' : 'end';
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor={textAnchor}
                    fill="hsl(var(--muted-foreground))"
                    fontSize={11}
                  >
                    {`${shortName} (${percentage.toFixed(0)}%)`}
                  </text>
                );
              }}
              labelLine={({ percentage, ...props }: any) => {
                if (percentage < 8) return <path />;
                return (
                  <path
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    d={`M${props.points[0].x},${props.points[0].y}L${props.points[1].x},${props.points[1].y}`}
                  />
                );
              }}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm max-w-xs">
                      <p className="text-sm font-medium truncate" title={data.name}>
                        {data.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{data.appName}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDuration(data.value)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {data.percentage.toFixed(1)}% of total
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data.focusCount} {data.focusCount === 1 ? 'focus' : 'focuses'}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
