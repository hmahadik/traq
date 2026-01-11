import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface HourlyFocus {
  hour: number;
  contextSwitches: number;
  focusQuality: number;
  focusLabel: string;
}

interface FocusDistributionChartProps {
  data: HourlyFocus[] | undefined;
  isLoading: boolean;
}

// Color mapping based on focus quality
const getFocusColor = (quality: number): string => {
  if (quality === 0) return 'hsl(var(--muted))'; // No activity - gray
  if (quality >= 75) return 'hsl(142, 76%, 36%)'; // Excellent/Good - green
  if (quality >= 50) return 'hsl(48, 96%, 53%)'; // Fair - yellow
  if (quality >= 25) return 'hsl(25, 95%, 53%)'; // Poor - orange
  return 'hsl(0, 84%, 60%)'; // Very Poor - red
};

export function FocusDistributionChart({ data, isLoading }: FocusDistributionChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Focus Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Show all 24 hours with inactive hours having different styling
  // Generate all 24 hours if data is missing hours
  const allHours = Array.from({ length: 24 }, (_, i) => i);
  const dataMap = new Map(data?.map(d => [d.hour, d]) || []);

  const chartData = allHours.map((hour) => {
    const existing = dataMap.get(hour);
    return {
      hour,
      hourLabel: `${hour.toString().padStart(2, '0')}:00`,
      contextSwitches: existing?.contextSwitches ?? 0,
      focusQuality: existing?.focusQuality ?? 0,
      focusLabel: existing?.focusLabel ?? 'No activity',
    };
  });

  // Check if there's any activity at all
  const hasActivity = chartData.some(d => d.focusQuality > 0);
  if (!hasActivity && (!data || data.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Focus Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            No activity data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Focus Distribution</CardTitle>
        <p className="text-sm text-muted-foreground">
          Hourly focus quality based on context switches
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            layout="horizontal"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="hourLabel"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm">
                      <p className="text-sm font-medium mb-1">{data.hourLabel}</p>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Focus: <span className="font-medium">{data.focusLabel}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Quality: <span className="font-medium">{data.focusQuality}%</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Context switches: <span className="font-medium">{data.contextSwitches}</span>
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="focusQuality" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getFocusColor(entry.focusQuality)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
            <span className="text-muted-foreground">Excellent/Good (75-100%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(48, 96%, 53%)' }} />
            <span className="text-muted-foreground">Fair (50-74%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(25, 95%, 53%)' }} />
            <span className="text-muted-foreground">Poor (25-49%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }} />
            <span className="text-muted-foreground">Very Poor (10-24%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
