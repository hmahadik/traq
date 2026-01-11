import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function DailySummaryCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Hero Time */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-32" />
          </div>
          {/* Stats Rows */}
          <div className="space-y-3 pt-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BreakdownBarSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          {/* Bar */}
          <Skeleton className="h-8 w-full rounded-full" />
          {/* Legend */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TopAppsSectionSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TimelineGridSkeleton() {
  return (
    <div className="flex gap-0 border rounded-lg overflow-hidden">
      {/* Hour Column */}
      <div className="w-[50px] bg-card border-r flex-shrink-0">
        <div className="space-y-0">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-[60px] border-b flex items-center justify-center"
            >
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary Column */}
      <div className="w-[160px] bg-card border-r flex-shrink-0">
        <div className="space-y-0 relative">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-[60px] border-b"
            />
          ))}
          {/* Summary blocks */}
          <div className="absolute top-4 left-2 right-2">
            <Skeleton className="h-[120px] w-full rounded" />
          </div>
          <div className="absolute top-[200px] left-2 right-2">
            <Skeleton className="h-[90px] w-full rounded" />
          </div>
        </div>
      </div>

      {/* App Columns */}
      {Array.from({ length: 6 }).map((_, colIdx) => (
        <div key={colIdx} className="w-[140px] bg-card border-r flex-shrink-0">
          {/* Header */}
          <div className="h-[60px] border-b px-2 flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <div className="flex-1">
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          {/* Activity blocks */}
          <div className="relative">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="h-[60px] border-b"
              />
            ))}
            {/* Sample activity blocks */}
            <div className="absolute top-2 left-2 right-2">
              <Skeleton className="h-[40px] w-full rounded" />
            </div>
            <div className="absolute top-[80px] left-2 right-2">
              <Skeleton className="h-[60px] w-full rounded" />
            </div>
            <div className="absolute top-[200px] left-2 right-2">
              <Skeleton className="h-[30px] w-full rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TimelinePageSkeleton() {
  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* Left Sidebar */}
      <div className="xl:w-80 xl:flex-shrink-0">
        <div className="space-y-4">
          <DailySummaryCardSkeleton />
          <BreakdownBarSkeleton />
          <TopAppsSectionSkeleton />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <TimelineGridSkeleton />
      </div>
    </div>
  );
}
