import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDate, formatDuration } from '@/lib/utils';
import { Calendar, FileText, Eye, Clock } from 'lucide-react';
import type { DailySummary } from '@/types';

interface DailySummariesListProps {
  summaries: DailySummary[] | undefined;
  isLoading: boolean;
  onView: (summaryId: number) => void;
}

export function DailySummariesList({
  summaries,
  isLoading,
  onView,
}: DailySummariesListProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Daily Summaries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summaries || summaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Daily Summaries
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-50" />
          <p>No daily summaries yet</p>
          <p className="text-sm mt-1">Generate daily summary reports to see them here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Daily Summaries
          <Badge variant="secondary" className="ml-auto">
            {summaries.length} days
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {summaries.map((summary) => (
              <div
                key={summary.id}
                className={`flex flex-col gap-2 p-4 rounded-lg border transition-colors hover:bg-accent/50 cursor-pointer ${
                  selectedId === summary.id ? 'bg-accent' : ''
                }`}
                onClick={() => {
                  setSelectedId(summary.id);
                  onView(summary.id);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">{formatDate(new Date(summary.date).getTime() / 1000)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {summary.sessionsCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {summary.sessionsCount} session{summary.sessionsCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {summary.totalTime > 0 && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(summary.totalTime)}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {summary.summary}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    Generated {formatDate(summary.createdAt)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(summary.id);
                    }}
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
