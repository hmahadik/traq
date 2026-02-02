import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import {
  Camera,
  Clock,
  Layers,
  Terminal,
  GitCommit,
  FileText,
  Globe,
  Trophy,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { DailyStats, Comparison } from '@/types';

interface StatsGridProps {
  stats: DailyStats | undefined;
  isLoading: boolean;
  className?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  tooltip?: string;
  comparisonPercent?: number;
  comparisonDiff?: number;
}

function formatComparisonValue(value: number, isTime: boolean = false): string {
  if (isTime) {
    // Format time differences in human-readable format
    const absValue = Math.abs(value);
    if (absValue < 60) return `${Math.round(absValue)}m`;
    const hours = Math.floor(absValue / 60);
    const minutes = Math.round(absValue % 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return Math.abs(value).toString();
}

function StatCard({ title, value, icon, description, tooltip, comparisonPercent, comparisonDiff }: StatCardProps) {
  const hasComparison = comparisonPercent !== undefined && comparisonDiff !== undefined;
  const isPositive = comparisonDiff !== undefined && comparisonDiff > 0;
  const isNegative = comparisonDiff !== undefined && comparisonDiff < 0;
  const isActiveTime = title === 'Active Time';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium leading-tight min-w-0">{title}</CardTitle>
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-4 w-4 shrink-0 text-muted-foreground cursor-help">{icon}</div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="h-4 w-4 shrink-0 text-muted-foreground">{icon}</div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hasComparison && comparisonDiff !== 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Badge
              variant="outline"
              className={`text-xs ${
                isPositive ? 'text-green-600 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800' :
                isNegative ? 'text-red-600 border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800' :
                'text-muted-foreground'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {isPositive ? '+' : ''}{comparisonPercent.toFixed(0)}%
            </Badge>
            <span className="text-xs text-muted-foreground">
              {isPositive ? '+' : isNegative ? '-' : ''}{formatComparisonValue(comparisonDiff, isActiveTime)} vs yesterday
            </span>
          </div>
        )}
        {(!hasComparison || comparisonDiff === 0) && description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-32 mt-2" />
      </CardContent>
    </Card>
  );
}

export function StatsGrid({ stats, isLoading, className }: StatsGridProps) {
  const gridClassName = className ?? "grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 2xl:grid-cols-8";

  if (isLoading) {
    return (
      <div className={gridClassName}>
        {Array.from({ length: 8 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const comp = stats.comparison;

  return (
    <TooltipProvider>
      <div className={gridClassName}>
        <StatCard
          title="Screenshots"
          value={stats.totalScreenshots}
          icon={<Camera className="h-4 w-4" />}
          description="Captures today"
          comparisonPercent={comp?.screenshotsPercent}
          comparisonDiff={comp?.screenshotsDiff}
        />
        <StatCard
          title="Active Time"
          value={formatDuration(stats.activeMinutes * 60)}
          icon={<Clock className="h-4 w-4" />}
          description="Total tracked time"
          tooltip="Time actively spent interacting with applications, calculated from window focus events. Excludes idle time (AFK)."
          comparisonPercent={comp?.activeMinutesPercent}
          comparisonDiff={comp?.activeMinutesDiff}
        />
      <StatCard
        title="Sessions"
        value={stats.totalSessions}
        icon={<Layers className="h-4 w-4" />}
        description="Work sessions"
        comparisonPercent={comp?.sessionsPercent}
        comparisonDiff={comp?.sessionsDiff}
      />
      <StatCard
        title="Shell Commands"
        value={stats.shellCommands}
        icon={<Terminal className="h-4 w-4" />}
        description="Terminal activity"
        comparisonPercent={comp?.shellCommandsPercent}
        comparisonDiff={comp?.shellCommandsDiff}
      />
      <StatCard
        title="Git Commits"
        value={stats.gitCommits}
        icon={<GitCommit className="h-4 w-4" />}
        description="Code commits"
        comparisonPercent={comp?.gitCommitsPercent}
        comparisonDiff={comp?.gitCommitsDiff}
      />
      <StatCard
        title="Files Modified"
        value={stats.filesModified}
        icon={<FileText className="h-4 w-4" />}
        description="File changes"
        comparisonPercent={comp?.filesModifiedPercent}
        comparisonDiff={comp?.filesModifiedDiff}
      />
      <StatCard
        title="Sites Visited"
        value={stats.sitesVisited}
        icon={<Globe className="h-4 w-4" />}
        description="Unique domains"
        comparisonPercent={comp?.sitesVisitedPercent}
        comparisonDiff={comp?.sitesVisitedDiff}
      />
      <StatCard
        title="Top App"
        value={stats.topApps?.[0]?.appName || 'N/A'}
        icon={<Trophy className="h-4 w-4" />}
        description={stats.topApps?.[0] ? `${stats.topApps[0].percentage.toFixed(1)}% of time` : ''}
      />
      </div>
    </TooltipProvider>
  );
}
