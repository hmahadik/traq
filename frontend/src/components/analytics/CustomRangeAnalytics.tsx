import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomRangeStats {
  startDate: string;
  endDate: string;
  bucketType: 'hourly' | 'daily' | 'weekly';
  totalActive: number;
  averages?: {
    activeMinutes: number;
    totalScreenshots: number;
    totalSessions: number;
  };
  hourlyBuckets?: Array<{
    hour: number;
    activeMinutes: number;
    screenshotCount: number;
  }>;
  dailyBuckets?: Array<{
    date: string;
    activeMinutes: number;
    totalScreenshots: number;
    totalSessions: number;
    shellCommands: number;
    gitCommits: number;
  }>;
  weeklyBuckets?: Array<{
    weekNumber: number;
    startDate: string;
    endDate: string;
    totalActive: number;
    activeDays: number;
  }>;
}

interface CustomRangeAnalyticsProps {
  data: CustomRangeStats | undefined;
  isLoading: boolean;
  onDayClick?: (date: string) => void;
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function CustomRangeAnalytics({ data, isLoading, onDayClick }: CustomRangeAnalyticsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available for this range
      </div>
    );
  }

  const renderHourlyChart = () => {
    if (!data.hourlyBuckets) return null;

    const chartData = data.hourlyBuckets.map(h => ({
      label: `${h.hour}:00`,
      hour: h.hour,
      activeMinutes: h.activeMinutes,
      screenshots: h.screenshotCount,
    }));

    return (
      <Card>
        <CardHeader>
          <CardTitle>Hourly Activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Activity breakdown by hour
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}m`}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm">
                        <p className="text-sm font-medium mb-1">
                          Hour {data.hour}:00 - {data.hour + 1}:00
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Active: {formatHours(data.activeMinutes)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Screenshots: {data.screenshots}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="activeMinutes"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const renderDailyChart = () => {
    if (!data.dailyBuckets) return null;

    const chartData = data.dailyBuckets.map(d => {
      const [y, m, dy] = d.date.split('-').map(Number);
      return {
        date: d.date,
        label: new Date(y, m - 1, dy).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        activeMinutes: d.activeMinutes,
        sessions: d.totalSessions,
      };
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Activity breakdown by day
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}m`}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm">
                        <p className="text-sm font-medium mb-1">
                          {(() => {
                            const [y, m, d] = data.date.split('-').map(Number);
                            return new Date(y, m - 1, d).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric',
                            });
                          })()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Active: {formatHours(data.activeMinutes)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Sessions: {data.sessions}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="activeMinutes"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                onClick={(data) => onDayClick?.(data.date)}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const renderWeeklyChart = () => {
    if (!data.weeklyBuckets) return null;

    const chartData = data.weeklyBuckets.map(w => ({
      label: `Week ${w.weekNumber}`,
      startDate: w.startDate,
      endDate: w.endDate,
      totalActive: w.totalActive,
      activeDays: w.activeDays,
    }));

    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Activity breakdown by week
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}m`}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm">
                        <p className="text-sm font-medium mb-1">
                          {new Date(data.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' - '}
                          {new Date(data.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Active: {formatHours(data.totalActive)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Active Days: {data.activeDays}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="totalActive"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  // Calculate stats
  const activeDays = data.dailyBuckets
    ? data.dailyBuckets.filter(d => d.activeMinutes > 0).length
    : data.weeklyBuckets
    ? data.weeklyBuckets.reduce((sum, w) => sum + w.activeDays, 0)
    : 0;

  const totalScreenshots = data.dailyBuckets
    ? data.dailyBuckets.reduce((sum, d) => sum + d.totalScreenshots, 0)
    : 0;

  const totalSessions = data.dailyBuckets
    ? data.dailyBuckets.reduce((sum, d) => sum + d.totalSessions, 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Active Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(data.totalActive)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.bucketType === 'hourly' ? 'Aggregated hours' :
               data.bucketType === 'daily' ? `Across ${activeDays} days` :
               `Across ${data.weeklyBuckets?.length} weeks`}
            </p>
          </CardContent>
        </Card>

        {data.averages && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Daily Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatHours(data.averages.activeMinutes)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per active day
              </p>
            </CardContent>
          </Card>
        )}

        {totalScreenshots > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Screenshots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalScreenshots}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Captured in range
              </p>
            </CardContent>
          </Card>
        )}

        {totalSessions > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSessions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Work sessions
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Activity Chart based on bucket type */}
      {data.bucketType === 'hourly' && renderHourlyChart()}
      {data.bucketType === 'daily' && renderDailyChart()}
      {data.bucketType === 'weekly' && renderWeeklyChart()}

      {/* Range Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground text-center">
            {new Date(data.startDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
            })} - {new Date(data.endDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })} ({data.bucketType} buckets)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
