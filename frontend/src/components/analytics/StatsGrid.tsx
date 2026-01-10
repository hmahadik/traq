import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDuration } from '@/lib/utils';
import {
  Camera,
  Clock,
  Layers,
  Terminal,
  GitCommit,
  FileText,
  Globe,
  Info,
} from 'lucide-react';
import type { DailyStats } from '@/types';

interface StatsGridProps {
  stats: DailyStats | undefined;
  isLoading: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  tooltip?: string;
}

function StatCard({ title, value, icon, description, tooltip }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
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

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 2xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 2xl:grid-cols-8">
        <StatCard
          title="Screenshots"
          value={stats.totalScreenshots}
          icon={<Camera className="h-4 w-4" />}
          description="Captures today"
        />
        <StatCard
          title="Active Time"
          value={formatDuration(stats.activeMinutes * 60)}
          icon={<Clock className="h-4 w-4" />}
          description="Total tracked time"
          tooltip="Time actively spent interacting with applications, calculated from window focus events. Excludes idle time (AFK)."
        />
      <StatCard
        title="Sessions"
        value={stats.totalSessions}
        icon={<Layers className="h-4 w-4" />}
        description="Work sessions"
      />
      <StatCard
        title="Shell Commands"
        value={stats.shellCommands}
        icon={<Terminal className="h-4 w-4" />}
        description="Terminal activity"
      />
      <StatCard
        title="Git Commits"
        value={stats.gitCommits}
        icon={<GitCommit className="h-4 w-4" />}
        description="Code commits"
      />
      <StatCard
        title="Files Modified"
        value={stats.filesModified}
        icon={<FileText className="h-4 w-4" />}
        description="File changes"
      />
      <StatCard
        title="Sites Visited"
        value={stats.sitesVisited}
        icon={<Globe className="h-4 w-4" />}
        description="Unique domains"
      />
      <StatCard
        title="Top App"
        value={stats.topApps?.[0]?.appName || 'N/A'}
        icon={<Camera className="h-4 w-4" />}
        description={stats.topApps?.[0] ? `${stats.topApps[0].percentage.toFixed(1)}% of time` : ''}
      />
      </div>
    </TooltipProvider>
  );
}
