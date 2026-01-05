import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessionsForDate } from '@/api/hooks';
import { formatDate, formatTimeRange, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function TimelinePage() {
  const [selectedDate] = useState(getTodayString());
  const { data: sessions, isLoading } = useSessionsForDate(selectedDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
        <p className="text-muted-foreground">{formatDate(Date.now() / 1000)}</p>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : sessions?.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No sessions recorded today</p>
            </CardContent>
          </Card>
        ) : (
          sessions?.map((session) => (
            <Card key={session.id} className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {formatTimeRange(session.startTime, session.endTime ?? session.startTime)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {session.screenshotCount} screenshots
                    </Badge>
                    <Badge variant="outline">
                      {formatDuration(session.durationSeconds ?? 0)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {session.summary ? (
                  <div className="space-y-2">
                    <p className="text-sm">{session.summary.summary}</p>
                    <div className="flex gap-2">
                      {session.summary.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No summary generated yet
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
