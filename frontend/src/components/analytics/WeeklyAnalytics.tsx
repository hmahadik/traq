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
  onDayClick?: (date: string) => void;
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function WeeklyAnalytics({ data, isLoading, onDayClick }: WeeklyAnalyticsProps) {
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
  // Worked time = first-to-last activity span per day, including breaks and
  // AFK time. Fall back to active time if the backend hasn't been updated yet.
  const totalActiveMinutes = data.totalActive;
  const totalWorkedMinutes = data.totalWorked ?? totalActiveMinutes;
  const activeDays = data.dailyStats.filter(d => d.activeMinutes > 0).length;
  const avgDailyMinutes = activeDays > 0 ? totalWorkedMinutes / activeDays : 0;

  // Break time = worked span minus active time per day (actual breaks + AFK)
  const totalBreakMinutes = data.dailyStats.reduce((sum, d) => {
    const workedMinutes = d.workedMinutes ?? d.activeMinutes;
    return sum + Math.max(0, workedMinutes - d.activeMinutes);
  }, 0);

  // Chart data - parse date strings as local time to get correct weekday labels
  const chartData = data.dailyStats.map(d => {
    const [y, m, dy] = d.date.split('-').map(Number);
    return {
      date: d.date,
      label: new Date(y, m - 1, dy).toLocaleDateString('en-US', { weekday: 'short' }),
      activeMinutes: d.activeMinutes,
      workedMinutes: d.workedMinutes ?? d.activeMinutes,
      sessions: d.totalSessions,
    };
  });

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Weekly Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              Total Hours Worked
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>First-to-last activity each day, including breaks and AFK time</p>
                </TooltipContent>
              </Tooltip>
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
              Per active day ({activeDays} {activeDays === 1 ? 'day' : 'days'})
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
                  <p>Breaks and AFK time between the first and last activity of each day</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totalBreakMinutes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Breaks and AFK time
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

      {/* Daily Hours Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Hours</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hours worked each day this week (incl. breaks and AFK)
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
                tickFormatter={(v) => formatHours(v)}
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
                onClick={(data) => onDayClick?.(data.date)}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Week Range Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground text-center">
            Week of {(() => {
              const [y, m, d] = data.startDate.split('-').map(Number);
              return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            })()} - {(() => {
              const [y, m, d] = data.endDate.split('-').map(Number);
              return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            })()}
          </div>
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}
