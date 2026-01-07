import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TagUsage {
  tag: string;
  sessionCount: number;
  totalMinutes: number;
  percentage: number;
}

interface ActivityTagsChartProps {
  data: TagUsage[] | undefined;
  isLoading: boolean;
  onTagClick?: (tag: string) => void;
}

// Format minutes to human-readable duration
const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export function ActivityTagsChart({ data, isLoading, onTagClick }: ActivityTagsChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Tags</CardTitle>
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
          <CardTitle>Activity Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No tagged sessions available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort by totalMinutes descending and take top 10
  const chartData = [...data]
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 10)
    .map((tag) => ({
      ...tag,
      durationLabel: formatDuration(tag.totalMinutes),
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Tags</CardTitle>
        <p className="text-sm text-muted-foreground">
          Top activity categories by time spent
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            layout="horizontal"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              type="number"
              domain={[0, 'dataMax']}
              label={{ value: 'Minutes', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              type="category"
              dataKey="tag"
              width={100}
              tick={{ fill: 'hsl(var(--foreground))' }}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              formatter={(value: number, name: string, props: any) => {
                if (name === 'totalMinutes') {
                  const { sessionCount, percentage } = props.payload;
                  return [
                    `${formatDuration(value)} (${percentage.toFixed(1)}%) - ${sessionCount} session${sessionCount !== 1 ? 's' : ''}`,
                    'Duration',
                  ];
                }
                return [value, name];
              }}
            />
            <Bar
              dataKey="totalMinutes"
              fill="hsl(217, 91%, 60%)"
              radius={[0, 4, 4, 0]}
              onClick={(data) => {
                if (onTagClick) {
                  onTagClick(data.tag);
                }
              }}
              style={{ cursor: onTagClick ? 'pointer' : 'default' }}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-4 flex justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-3 w-3 rounded bg-[hsl(217,91%,60%)]" />
            <span>Time spent per activity tag</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
