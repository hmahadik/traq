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
import type { AppUsage } from '@/types';

interface AppUsageChartProps {
  data: AppUsage[] | undefined;
  isLoading: boolean;
}

export function AppUsageChart({ data, isLoading }: AppUsageChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>App Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.map((app) => ({
    name: app.appName,
    value: app.durationSeconds,
    percentage: app.percentage,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Usage</CardTitle>
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
              label={({ name, percentage, cx, cy, midAngle, outerRadius, x, y }) => {
                if (percentage < 5) return null;
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
                    fontSize={12}
                  >
                    {`${name} (${percentage.toFixed(1)}%)`}
                  </text>
                );
              }}
              labelLine={({ percentage, ...props }: any) => {
                if (percentage < 5) return <path />;
                return (
                  <path
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    d={`M${props.points[0].x},${props.points[0].y}L${props.points[1].x},${props.points[1].y}`}
                  />
                );
              }}
            >
              {chartData?.map((_, index) => (
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
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <p className="text-sm font-medium">{data.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDuration(data.value)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {data.percentage.toFixed(1)}% of total
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
