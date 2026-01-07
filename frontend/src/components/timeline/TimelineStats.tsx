import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { formatDuration, formatTimestamp } from '@/lib/utils';
import { Clock, Calendar, Coffee, Target } from 'lucide-react';
import type { Session } from '@/types';

interface TimelineStatsProps {
  sessions: Session[] | undefined;
  isLoading: boolean;
  date: Date;
}

interface DayStats {
  totalActiveTime: number; // seconds
  startTime: number | null; // timestamp
  endTime: number | null; // timestamp
  breaksCount: number;
  breaksDuration: number; // seconds
  longestFocus: number; // seconds
}

function calculateDayStats(sessions: Session[], date: Date): DayStats {
  if (!sessions || sessions.length === 0) {
    return {
      totalActiveTime: 0,
      startTime: null,
      endTime: null,
      breaksCount: 0,
      breaksDuration: 0,
      longestFocus: 0,
    };
  }

  // Calculate day boundaries (in seconds)
  const dayStart = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000);
  const dayEnd = dayStart + 86400 - 1; // End of day (23:59:59)

  // Sort sessions by start time
  const sortedSessions = [...sessions].sort((a, b) => a.startTime - b.startTime);

  // Calculate total active time, clamping each session to day boundaries
  // This ensures sessions that span midnight only count time within the selected day
  const totalActiveTime = sortedSessions.reduce((sum, session) => {
    const sessionStart = Math.max(session.startTime, dayStart);
    const sessionEnd = Math.min(session.endTime || session.startTime, dayEnd);
    const clampedDuration = Math.max(0, sessionEnd - sessionStart);
    return sum + clampedDuration;
  }, 0);

  // Day span - clamp times to the selected day
  // This ensures we show the day's activity range, not cross-day spans
  let startTime = sortedSessions[0].startTime;
  let endTime = sortedSessions[sortedSessions.length - 1].endTime || sortedSessions[sortedSessions.length - 1].startTime;

  // Clamp to day boundaries
  if (startTime < dayStart) startTime = dayStart;
  if (endTime > dayEnd) endTime = dayEnd;

  // Calculate breaks as gaps between consecutive sessions
  // A "break" is defined as a gap between 3 minutes and 2 hours
  // - Gaps < 3 minutes are session transitions, not breaks
  // - Gaps > 2 hours are considered "away time" (lunch, overnight, etc.), not breaks
  const MIN_BREAK_SECONDS = 180;     // 3 minutes
  const MAX_BREAK_SECONDS = 7200;    // 2 hours

  let breaksCount = 0;
  let breaksDuration = 0;

  for (let i = 1; i < sortedSessions.length; i++) {
    const prevSession = sortedSessions[i - 1];
    const currentSession = sortedSessions[i];

    // Clamp session times to day boundaries for accurate gap calculation
    const prevEnd = Math.min(
      Math.max(prevSession.endTime || prevSession.startTime, dayStart),
      dayEnd
    );
    const currStart = Math.min(
      Math.max(currentSession.startTime, dayStart),
      dayEnd
    );

    const gap = currStart - prevEnd;

    // Only count gaps within the break threshold range
    if (gap > MIN_BREAK_SECONDS && gap <= MAX_BREAK_SECONDS) {
      breaksCount++;
      breaksDuration += gap;
    }
  }

  // Find longest focus period (longest session)
  const longestFocus = Math.max(...sortedSessions.map(s => s.durationSeconds || 0));

  return {
    totalActiveTime,
    startTime,
    endTime,
    breaksCount,
    breaksDuration,
    longestFocus,
  };
}


function StatsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-6 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TimelineStats({ sessions, isLoading, date }: TimelineStatsProps) {
  if (isLoading) {
    return <StatsSkeleton />;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            No activity recorded
          </p>
        </CardContent>
      </Card>
    );
  }

  const stats = calculateDayStats(sessions, date);
  const dailyGoalHours = 8; // TODO: Get from config
  const dailyGoalSeconds = dailyGoalHours * 3600;
  const hoursWorkedPercent = (stats.totalActiveTime / dailyGoalSeconds) * 100;

  return (
    <div className="space-y-4">
      {/* Hours Worked */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Hours Worked
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-2xl font-bold">
            {formatDuration(stats.totalActiveTime)}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{hoursWorkedPercent.toFixed(0)}% of goal</span>
              <span>{dailyGoalHours}h goal</span>
            </div>
            <Progress value={Math.min(hoursWorkedPercent, 100)} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Day Span */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Day Span
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold">
            {stats.startTime && stats.endTime
              ? `${formatTimestamp(stats.startTime)} - ${formatTimestamp(stats.endTime)}`
              : 'N/A'}
          </div>
        </CardContent>
      </Card>

      {/* Breaks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Coffee className="h-4 w-4 text-muted-foreground" />
            Breaks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold">
            {stats.breaksCount} {stats.breaksCount === 1 ? 'break' : 'breaks'}
          </div>
          {stats.breaksDuration > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatDuration(stats.breaksDuration)} total
            </p>
          )}
        </CardContent>
      </Card>

      {/* Longest Focus */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Longest Focus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold">
            {formatDuration(stats.longestFocus)}
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Bar Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Time Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex h-8 rounded-md overflow-hidden">
            <div
              className="bg-green-500 flex items-center justify-center"
              style={{
                width: `${(stats.totalActiveTime / (stats.totalActiveTime + stats.breaksDuration)) * 100}%`,
              }}
            >
              {stats.totalActiveTime > 0 && (
                <span className="text-xs font-medium text-white">Focus</span>
              )}
            </div>
            <div
              className="bg-orange-500 flex items-center justify-center"
              style={{
                width: `${(stats.breaksDuration / (stats.totalActiveTime + stats.breaksDuration)) * 100}%`,
              }}
            >
              {stats.breaksDuration > 0 && (
                <span className="text-xs font-medium text-white">Breaks</span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Focus: {formatDuration(stats.totalActiveTime)}</span>
            <span>Breaks: {formatDuration(stats.breaksDuration)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
