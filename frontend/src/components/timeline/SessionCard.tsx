import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TagBadge } from '@/components/common/TagBadge';
import { AppBadge } from '@/components/common/AppBadge';
import { ImageGallery } from '@/components/common/ImageGallery';
import { formatTimeRange, formatDuration, cn } from '@/lib/utils';
import { useThumbnail } from '@/api/hooks';
import {
  Camera,
  Clock,
  Sparkles,
  Loader2,
  Terminal,
  GitBranch,
  FileText,
  Globe,
  ZoomIn,
  ChevronRight,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import type { SessionSummary, Screenshot } from '@/types';

// Thumbnail with zoom overlay on hover
function ThumbnailImage({ screenshot, showZoom = false }: { screenshot: Screenshot; showZoom?: boolean }) {
  const { data: thumbnailUrl, isLoading } = useThumbnail(screenshot.id);

  if (isLoading) {
    return <Skeleton className="absolute inset-0" />;
  }

  return (
    <>
      <img
        src={thumbnailUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
        loading="lazy"
      />
      {showZoom && (
        <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/40 transition-colors flex items-center justify-center">
          <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
        </div>
      )}
    </>
  );
}

interface SessionCardProps {
  session: SessionSummary;
  thumbnails?: Screenshot[];
  isSelected?: boolean;
  onSelect?: () => void;
  onGenerateSummary?: () => void;
  isGeneratingSummary?: boolean;
}

export function SessionCard({
  session,
  thumbnails = [],
  isSelected = false,
  onSelect,
  onGenerateSummary,
  isGeneratingSummary = false,
}: SessionCardProps) {
  const navigate = useNavigate();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const handleCardClick = () => {
    navigate(`/session/${session.id}`);
  };

  const handleThumbnailClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const handleGenerateSummary = (e: React.MouseEvent) => {
    e.stopPropagation();
    onGenerateSummary?.();
  };

  const displayThumbnails = thumbnails.slice(0, 5);
  const remainingCount = Math.max(0, session.screenshotCount - displayThumbnails.length);

  return (
    <>
      <Card
        data-testid="session-card"
        className={cn(
          'group transition-all cursor-pointer',
          'hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5',
          isSelected && 'ring-2 ring-primary shadow-lg'
        )}
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          {/* Main row: Time, Summary, Meta */}
          <div className="flex items-start gap-4">
            {/* Left: Time and Summary */}
            <div className="flex-1 min-w-0">
              {/* Time range with arrow indicator */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-base">
                  {formatTimeRange(session.startTime, session.endTime ?? session.startTime)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Summary or Generate button */}
              {session.summary ? (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {session.summary}
                </p>
              ) : (
                <div className="mb-2">
                  {onGenerateSummary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                      onClick={handleGenerateSummary}
                      disabled={isGeneratingSummary}
                    >
                      {isGeneratingSummary ? (
                        <>
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1.5 h-3 w-3" />
                          Generate summary
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Apps and Tags row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Top Apps */}
                {session.topApps && session.topApps.length > 0 && (
                  <div className="flex items-center gap-1">
                    {session.topApps.slice(0, 3).map((app) => (
                      <AppBadge key={app} appName={app} size="sm" showName={false} />
                    ))}
                    {session.topApps.length > 3 && (
                      <span className="text-xs text-muted-foreground ml-0.5">
                        +{session.topApps.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Tags */}
                {session.tags && session.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    {session.tags.slice(0, 2).map((tag) => (
                      <TagBadge key={tag} tag={tag} size="sm" />
                    ))}
                    {session.tags.length > 2 && (
                      <span className="text-xs text-muted-foreground">
                        +{session.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Data Source Indicators */}
                <TooltipProvider>
                  <div className="flex items-center gap-1">
                    {session.hasShell && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-1 rounded bg-primary/10 text-primary">
                            <Terminal className="h-3 w-3" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Shell commands</TooltipContent>
                      </Tooltip>
                    )}
                    {session.hasGit && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-1 rounded bg-orange-500/10 text-orange-500">
                            <GitBranch className="h-3 w-3" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Git activity</TooltipContent>
                      </Tooltip>
                    )}
                    {session.hasFiles && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-1 rounded bg-green-500/10 text-green-500">
                            <FileText className="h-3 w-3" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>File events</TooltipContent>
                      </Tooltip>
                    )}
                    {session.hasBrowser && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-1 rounded bg-blue-500/10 text-blue-500">
                            <Globe className="h-3 w-3" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Browser history</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TooltipProvider>
              </div>
            </div>

            {/* Right: Meta badges */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <Badge variant="secondary" className="gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {session.isOngoing
                  ? formatDuration(Math.floor(Date.now() / 1000) - session.startTime)
                  : formatDuration(session.durationSeconds ?? 0)}
              </Badge>
              <Badge variant="outline" className="gap-1 text-xs">
                <Camera className="h-3 w-3" />
                {session.screenshotCount}
              </Badge>
            </div>
          </div>

          {/* Thumbnails filmstrip */}
          {displayThumbnails.length > 0 && (
            <div className="flex gap-1.5 mt-3 overflow-hidden">
              {displayThumbnails.map((thumb, index) => (
                <div
                  key={thumb.id}
                  className="group/thumb relative flex-shrink-0 w-[72px] h-[40px] rounded overflow-hidden bg-muted cursor-pointer ring-1 ring-border hover:ring-2 hover:ring-primary transition-all"
                  onClick={(e) => handleThumbnailClick(e, index)}
                >
                  <ThumbnailImage screenshot={thumb} showZoom />
                </div>
              ))}
              {remainingCount > 0 && (
                <div
                  className="flex-shrink-0 w-[72px] h-[40px] rounded bg-muted/50 flex items-center justify-center border border-dashed border-border hover:border-primary hover:bg-muted transition-colors cursor-pointer"
                  onClick={(e) => handleThumbnailClick(e, displayThumbnails.length - 1)}
                >
                  <span className="text-xs font-medium text-muted-foreground">+{remainingCount}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fullscreen Image Gallery */}
      {thumbnails.length > 0 && (
        <ImageGallery
          screenshots={thumbnails}
          initialIndex={galleryIndex}
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
        />
      )}
    </>
  );
}

export function SessionCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        </div>
        <div className="flex gap-1.5 mt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-[72px] h-[40px] rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
