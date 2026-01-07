import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AppBadge } from '@/components/common/AppBadge';
import { formatDuration } from '@/lib/utils';
import type { WindowUsage } from '@/types';

interface TopWindowsListProps {
  data: WindowUsage[] | undefined;
  isLoading: boolean;
  onWindowClick?: (windowTitle: string, appName: string) => void;
}

export function TopWindowsList({ data, isLoading, onWindowClick }: TopWindowsListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Windows</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Windows</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No window data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Windows</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((window, index) => (
            <div
              key={`${window.appName}-${window.windowTitle}-${index}`}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => onWindowClick?.(window.windowTitle, window.appName)}
            >
              {/* App Badge */}
              <div className="flex-shrink-0 mt-0.5">
                <AppBadge appName={window.appName} size="sm" />
              </div>

              {/* Window Title and Duration */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate" title={window.windowTitle}>
                  {window.windowTitle}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(window.durationSeconds)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    • {window.focusCount} {window.focusCount === 1 ? 'focus' : 'focuses'}
                  </span>
                </div>
              </div>

              {/* Percentage */}
              <div className="flex-shrink-0 text-right">
                <div className="text-sm font-medium">
                  {window.percentage.toFixed(1)}%
                </div>
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(window.percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
