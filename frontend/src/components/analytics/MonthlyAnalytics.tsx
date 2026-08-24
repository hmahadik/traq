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
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { MonthlyStats } from '@/types';

interface MonthlyAnalyticsProps {
  data: MonthlyStats | undefined;
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

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}

export function MonthlyAnalytics({ data, isLoading, onDayClick }: MonthlyAnalyticsProps) {
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
  // Worked time = first-to-last activity span per day, including breaks and
  // AFK time. Fall back to active time if the backend hasn't been updated yet.
  const totalActiveMinutes = data.totalActive;
  const totalWorkedMinutes = data.totalWorked ?? totalActiveMinutes;
  const activeDays = data.dailyStats.filter(d => d.activeMinutes > 0).length;
  const avgDailyMinutes = activeDays > 0 ? totalWorkedMinutes / activeDays : 0;
  const daysInMonth = data.dailyStats.length;

  // Calculate totals
  const totalScreenshots = data.dailyStats.reduce((sum, d) => sum + d.totalScreenshots, 0);
  const totalSessions = data.dailyStats.reduce((sum, d) => sum + d.totalSessions, 0);
  const totalShellCommands = data.dailyStats.reduce((sum, d) => sum + d.shellCommands, 0);
  const totalGitCommits = data.dailyStats.reduce((sum, d) => sum + d.gitCommits, 0);

  // Daily activity chart data (show all days in the month)
  // Parse date strings as local time (new Date("YYYY-MM-DD") parses as UTC, causing wrong day numbers)
  const dailyChartData = data.dailyStats.map(d => {
    const dayNum = parseInt(d.date.split('-')[2], 10);
    return {
      date: d.date,
      day: dayNum,
      dayLabel: `${dayNum}`,
      activeMinutes: d.activeMinutes,
      workedMinutes: d.workedMinutes ?? d.activeMinutes,
      sessions: d.totalSessions,
      screenshots: d.totalScreenshots,
    };
  });

  const monthName = getMonthName(data.month);

  return (
    <div className="space-y-4">
      {/* Monthly Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              Total Hours Worked
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>First-to-last activity each day, including breaks and AFK time</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totalWorkedMinutes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatHours(totalActiveMinutes)} active across {activeDays} {activeDays === 1 ? 'day' : 'days'}
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
              {activeDays > 0 ? (totalSessions / activeDays).toFixed(1) : 0} avg/day
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
              Peak Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dailyChartData.length > 0
                ? (() => {
                    const peakDay = dailyChartData.reduce((max, d) => d.workedMinutes > max.workedMinutes ? d : max, dailyChartData[0]);
                    const [y, m, d] = peakDay.date.split('-').map(Number);
                    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  })()
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Most hours worked
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

      {/* Daily Hours Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Hours</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hours worked each day in {monthName} (incl. breaks and AFK)
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="dayLabel"
                className="text-sm"
                tick={{ fill: 'currentColor', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
                label={{ value: `Day of ${monthName}`, position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                className="text-sm"
                tick={{ fill: 'currentColor' }}
                tickFormatter={(v) => formatHours(v)}
              />
              <Tooltip
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
                          Worked: {formatHours(data.workedMinutes)}
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
                dataKey="workedMinutes"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
                cursor={onDayClick ? 'pointer' : 'default'}
                onClick={(data) => {
                  if (onDayClick && data && data.date) {
                    onDayClick(data.date);
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
