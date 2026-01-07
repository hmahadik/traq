import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { MonthlyStats } from '@/types';

interface MonthlyAnalyticsProps {
  data: MonthlyStats | undefined;
  isLoading: boolean;
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}

export function MonthlyAnalytics({ data, isLoading }: MonthlyAnalyticsProps) {
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

        {/* Weekly Breakdown Chart */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>

        {/* Daily Trend Chart */}
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

  if (!data || !data.dailyStats || data.dailyStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No monthly data available
      </div>
    );
  }

  // Calculate metrics
  const totalActiveMinutes = data.totalActive;
  const activeDays = data.dailyStats.filter(d => d.activeMinutes > 0).length;
  const avgDailyMinutes = activeDays > 0 ? totalActiveMinutes / activeDays : 0;
  const daysInMonth = data.dailyStats.length;

  // Calculate totals
  const totalScreenshots = data.dailyStats.reduce((sum, d) => sum + d.totalScreenshots, 0);
  const totalSessions = data.dailyStats.reduce((sum, d) => sum + d.totalSessions, 0);
  const totalShellCommands = data.dailyStats.reduce((sum, d) => sum + d.shellCommands, 0);
  const totalGitCommits = data.dailyStats.reduce((sum, d) => sum + d.gitCommits, 0);

  // Weekly breakdown chart data
  const weeklyChartData = data.weeklyStats?.map(week => ({
    week: `Week ${week.weekNumber}`,
    activeMinutes: week.totalActive,
    activeDays: week.activeDays,
    avgPerDay: week.activeDays > 0 ? Math.round(week.totalActive / week.activeDays) : 0,
  })) || [];

  // Daily trend chart data (show every few days to avoid overcrowding)
  const samplingRate = Math.max(1, Math.floor(daysInMonth / 15)); // Show ~15 data points
  const trendChartData = data.dailyStats
    .filter((_, index) => index % samplingRate === 0)
    .map(d => {
      const date = new Date(d.date);
      return {
        date: d.date,
        label: `${date.getDate()}`,
        activeMinutes: d.activeMinutes,
        sessions: d.totalSessions,
      };
    });

  const monthName = getMonthName(data.month);

  return (
    <div className="space-y-4">
      {/* Month Info */}
      <div className="text-sm text-muted-foreground">
        {monthName} {data.year} • {data.startDate} to {data.endDate}
      </div>

      {/* Monthly Metrics Grid */}
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
              Across {activeDays} days
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
              Per active day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDays}/{daysInMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((activeDays / daysInMonth) * 100)}% of month
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
              {totalScreenshots} screenshots
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Shell Commands
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShellCommands.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeDays > 0 ? Math.round(totalShellCommands / activeDays) : 0} avg/day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Git Commits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGitCommits}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeDays > 0 ? (totalGitCommits / activeDays).toFixed(1) : 0} avg/day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Peak Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {weeklyChartData.length > 0
                ? `Week ${weeklyChartData.reduce((max, w) => w.activeMinutes > max.activeMinutes ? w : max, weeklyChartData[0]).week.split(' ')[1]}`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Most active week
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
            <div className="text-2xl font-bold">
              {activeDays >= 20 ? 'High' : activeDays >= 10 ? 'Medium' : 'Low'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Activity level
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Breakdown Chart */}
      {weeklyChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Week-over-Week Activity</CardTitle>
            <p className="text-sm text-muted-foreground">
              Active time per week throughout the month
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="week"
                  className="text-sm"
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis
                  className="text-sm"
                  tick={{ fill: 'currentColor' }}
                  label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'activeMinutes') return [formatHours(value), 'Active Time'];
                    if (name === 'activeDays') return [value, 'Active Days'];
                    if (name === 'avgPerDay') return [formatHours(value), 'Avg/Day'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="activeMinutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily Activity Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity Trend</CardTitle>
          <p className="text-sm text-muted-foreground">
            Active time throughout the month
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                className="text-sm"
                tick={{ fill: 'currentColor' }}
                label={{ value: `Day of ${monthName}`, position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                className="text-sm"
                tick={{ fill: 'currentColor' }}
                label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'activeMinutes') return [formatHours(value as number), 'Active Time'];
                  if (name === 'sessions') return [value, 'Sessions'];
                  return [value, name];
                }}
                labelFormatter={(label) => {
                  const item = trendChartData.find(d => d.label === label);
                  if (item) {
                    const date = new Date(item.date);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  }
                  return label;
                }}
              />
              <Line
                type="monotone"
                dataKey="activeMinutes"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
