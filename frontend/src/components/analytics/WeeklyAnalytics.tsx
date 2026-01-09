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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { WeeklyStats } from '@/types';

interface WeeklyAnalyticsProps {
  data: WeeklyStats | undefined;
  isLoading: boolean;
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function WeeklyAnalytics({ data, isLoading }: WeeklyAnalyticsProps) {
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

        {/* Daily Activity Chart */}
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
        No weekly data available
      </div>
    );
  }

  // Calculate metrics
  // Filter to only include completed workdays (not today, not weekends)
  const today = new Date().toISOString().split('T')[0];
  const completedWorkdays = data.dailyStats.filter(d => {
    const date = new Date(d.date);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday = d.date === today;
    return !isWeekend && !isToday && d.activeMinutes > 0;
  });

  const totalActiveMinutesWorkdays = completedWorkdays.reduce((sum, d) => sum + d.activeMinutes, 0);
  const avgDailyMinutes = completedWorkdays.length > 0 ? totalActiveMinutesWorkdays / completedWorkdays.length : 0;

  // For display purposes, we still show total active time for all days
  const totalActiveMinutes = data.totalActive;
  const activeDays = data.dailyStats.filter(d => d.activeMinutes > 0).length;

  // Calculate total break time (assuming work time is 8 hours, breaks are the rest)
  // This is a simplified calculation - in reality you'd track breaks separately
  const totalBreakMinutes = data.dailyStats.reduce((sum, d) => {
    const workMinutes = d.activeMinutes;
    const breakMinutes = workMinutes > 0 ? Math.max(0, (8 * 60) - workMinutes) : 0;
    return sum + breakMinutes;
  }, 0);

  // Chart data
  const chartData = data.dailyStats.map(d => ({
    date: d.date,
    label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    activeMinutes: d.activeMinutes,
    sessions: d.totalSessions,
  }));

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Weekly Metrics Grid */}
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
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              Avg Daily Hours
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Average hours per completed workday (Monday-Friday, excluding today and days with no activity)</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(Math.round(avgDailyMinutes))}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per completed workday ({completedWorkdays.length} days)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              Total Break Time
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Estimated break time calculated as the difference between 8-hour workday and actual active time for each day</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totalBreakMinutes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Estimated breaks
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
            <div className="text-2xl font-bold">{activeDays}/7</div>
            <p className="text-xs text-muted-foreground mt-1">
              Days with activity
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
            <div className="text-2xl font-bold">
              {data.dailyStats.reduce((sum, d) => sum + d.totalScreenshots, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Captured this week
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
            <div className="text-2xl font-bold">
              {data.dailyStats.reduce((sum, d) => sum + d.totalSessions, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Work sessions
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
            <div className="text-2xl font-bold">
              {data.dailyStats.reduce((sum, d) => sum + d.shellCommands, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Terminal activity
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
            <div className="text-2xl font-bold">
              {data.dailyStats.reduce((sum, d) => sum + d.gitCommits, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Code commits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Active time for each day this week
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
                          {new Date(data.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })}
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
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Week Range Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground text-center">
            Week of {new Date(data.startDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
            })} - {new Date(data.endDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}
