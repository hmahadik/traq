import { useState } from 'react';
import { ChevronDown, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Screenshot } from '@/types';
import { Screenshot as ScreenshotComponent } from '@/components/common/Screenshot';

interface HourGroupProps {
  hour: number;
  screenshots: Screenshot[];
  isLoading?: boolean;
  onScreenshotClick?: (screenshot: Screenshot, index: number) => void;
  defaultExpanded?: boolean;
}

export function HourGroup({
  hour,
  screenshots,
  isLoading = false,
  onScreenshotClick,
  defaultExpanded = true,
}: HourGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hourLabel = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`;
  const count = screenshots.length;

  return (
    <Card data-testid="hour-group" className={cn('transition-all', !expanded && 'hover:bg-accent/50')}>
      <CardHeader
        className="py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <span className="text-sm font-medium">{hourLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            <span className="text-sm">{count} screenshots</span>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pb-3 pt-0">
          {isLoading ? (
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded" />
              ))}
            </div>
          ) : count === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No screenshots in this hour
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {screenshots.map((screenshot, index) => (
                <div
                  key={screenshot.id}
                  data-testid="screenshot-thumbnail"
                  onClick={() => onScreenshotClick?.(screenshot, index)}
                >
                  <ScreenshotComponent
                    screenshot={screenshot}
                    size="thumbnail"
                    showOverlay={true}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface HourGroupSkeletonProps {
  count?: number;
}

export function HourGroupSkeleton({ count = 5 }: HourGroupSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
          </CardHeader>
          <CardContent className="pb-3 pt-0">
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="aspect-video rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
