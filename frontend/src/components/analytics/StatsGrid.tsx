import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/utils';
import {
  Camera,
  Clock,
  Layers,
  Terminal,
  GitCommit,
  FileText,
  Globe,
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
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        value={stats.topApps[0]?.appName || 'N/A'}
        icon={<Camera className="h-4 w-4" />}
        description={stats.topApps[0] ? `${stats.topApps[0].percentage}% of time` : ''}
      />
    </div>
  );
}
