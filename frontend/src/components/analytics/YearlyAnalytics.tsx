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
import type { YearlyStats } from '@/types';

interface YearlyAnalyticsProps {
  data: YearlyStats | undefined;
  isLoading: boolean;
  onMonthClick?: (monthNumber: number) => void;
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function YearlyAnalytics({ data, isLoading, onMonthClick }: YearlyAnalyticsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
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

        {/* Chart */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || !data.monthlyStats || data.monthlyStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No yearly data available
      </div>
    );
  }

  // Calculate metrics
  const totalActiveMinutes = data.totalActive;
  const activeMonths = data.activeMonths;
  const avgMonthlyMinutes = activeMonths > 0 ? totalActiveMinutes / activeMonths : 0;

  // Calculate totals
  const totalScreenshots = data.monthlyStats.reduce((sum, m) => sum + m.screenshots, 0);
  const totalSessions = data.monthlyStats.reduce((sum, m) => sum + m.sessions, 0);
  const totalActiveDays = data.monthlyStats.reduce((sum, m) => sum + m.activeDays, 0);
  const avgDailyMinutes = totalActiveDays > 0 ? totalActiveMinutes / totalActiveDays : 0;

  // Find peak month
  const peakMonth = data.monthlyStats.reduce((max, month) =>
    month.totalActive > max.totalActive ? month : max
  , data.monthlyStats[0]);

  // Calculate consistency (how many months have activity)
  const consistencyLevel = activeMonths >= 10 ? 'High' : activeMonths >= 6 ? 'Medium' : 'Low';

  // Monthly chart data
  const monthlyChartData = data.monthlyStats.map(month => ({
    month: month.monthName.substring(0, 3), // Short month name
    monthFull: month.monthName,
    monthNumber: month.monthNumber,
    activeMinutes: month.totalActive,
    activeDays: month.activeDays,
    sessions: month.sessions,
  }));

  return (
    <div className="space-y-4">
      {/* Year Info */}
      <div className="text-sm text-muted-foreground">
        {data.year} • {data.startDate} to {data.endDate}
      </div>

      {/* Yearly Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Active Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totalActiveMinutes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {activeMonths} months
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Monthly Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(Math.round(avgMonthlyMinutes))}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per active month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Daily Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(Math.round(avgDailyMinutes))}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {totalActiveDays} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Months
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMonths}/12</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((activeMonths / 12) * 100)}% of year
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Screenshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalScreenshots.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(totalScreenshots / 12)} avg/month
            </p>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Peak Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{peakMonth.monthName.substring(0, 3)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatHours(peakMonth.totalActive)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Consistency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consistencyLevel}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Activity level
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Activity</CardTitle>
          <p className="text-sm text-muted-foreground">Active time per month throughout the year</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${Math.round(value / 60)}h`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover text-popover-foreground border border-border rounded-lg p-3 shadow-md">
                        <p className="font-semibold">{data.monthFull}</p>
                        <p className="text-sm">
                          Active Time: {formatHours(data.activeMinutes)}
                        </p>
                        <p className="text-sm">
                          Active Days: {data.activeDays}
                        </p>
                        <p className="text-sm">
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
                onClick={(data) => {
                  if (onMonthClick && data && data.monthNumber) {
                    onMonthClick(data.monthNumber);
                  }
                }}
                cursor={onMonthClick ? 'pointer' : 'default'}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
