import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TagList } from '@/components/common/TagBadge';
import { ConfidenceBadge } from '@/components/common/ConfidenceBadge';
import { AppBadge } from '@/components/common/AppBadge';
import { formatTimeRange, formatDuration, cn } from '@/lib/utils';
import { useThumbnail } from '@/api/hooks';
import {
  ChevronDown,
  ChevronRight,
  Camera,
  Clock,
  ExternalLink,
  Sparkles,
  Loader2,
  Terminal,
  GitBranch,
  FileText,
  Globe,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import type { SessionSummary, Screenshot } from '@/types';

// Small thumbnail component that loads via hook
function ThumbnailImage({ screenshot }: { screenshot: Screenshot }) {
  const { data: thumbnailUrl, isLoading } = useThumbnail(screenshot.id);

  if (isLoading) {
    return <Skeleton className="absolute inset-0" />;
  }

  return (
    <img
      src={thumbnailUrl}
      alt=""
      className="absolute inset-0 w-full h-full object-cover"
      loading="lazy"
    />
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
  const [expanded, setExpanded] = useState(false);

  const handleViewDetails = () => {
    navigate(`/session/${session.id}`);
  };

  const displayThumbnails = thumbnails.slice(0, 6);
  const remainingCount = session.screenshotCount - displayThumbnails.length;

  return (
    <Card
      data-testid="session-card"
      className={cn(
        'transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
        'cursor-pointer'
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              <span className="font-semibold">
                {formatTimeRange(session.startTime, session.endTime ?? session.startTime)}
              </span>
            </div>
            {session.summary && (
              <p className="text-sm text-muted-foreground mt-2 ml-8 line-clamp-2">
                {session.summary.summary}
              </p>
            )}
            {/* Top Apps */}
            {session.topApps && session.topApps.length > 0 && (
              <div className="flex items-center gap-2 mt-2 ml-8" data-testid="top-apps">
                {session.topApps.slice(0, 3).map((app) => (
                  <AppBadge key={app} appName={app} size="sm" showName={false} />
                ))}
                {session.topApps.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{session.topApps.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Camera className="h-3 w-3" />
                {session.screenshotCount}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(session.durationSeconds ?? 0)}
              </Badge>
            </div>
            {/* Data Source Indicators */}
            {(session.hasShell || session.hasGit || session.hasFiles || session.hasBrowser) && (
              <TooltipProvider>
                <div className="flex items-center gap-1" data-testid="data-source-indicators">
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
            )}
            {session.summary && (
              <ConfidenceBadge confidence={session.summary.confidence} />
            )}
          </div>
        </div>
      </CardHeader>

      {/* Filmstrip */}
      {displayThumbnails.length > 0 && (
        <CardContent className="pt-0 pb-3">
          <div className="flex gap-1 overflow-hidden">
            {displayThumbnails.map((thumb) => (
              <div
                key={thumb.id}
                className="relative flex-shrink-0 w-20 h-[45px] rounded overflow-hidden bg-muted"
              >
                <ThumbnailImage screenshot={thumb} />
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="flex-shrink-0 w-20 h-[45px] rounded bg-primary/10 flex items-center justify-center border border-primary/20">
                <span className="text-sm font-medium text-primary">+{remainingCount}</span>
              </div>
            )}
          </div>
        </CardContent>
      )}

      {/* Expanded Content */}
      {expanded && (
        <CardContent className="pt-0 border-t">
          <div className="pt-4 space-y-4">
            {/* Summary Section */}
            {session.summary ? (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-1">Summary</h4>
                  <p className="text-sm text-muted-foreground">
                    {session.summary.summary}
                  </p>
                </div>
                {session.summary.explanation && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Details</h4>
                    <p className="text-sm text-muted-foreground">
                      {session.summary.explanation}
                    </p>
                  </div>
                )}
                {session.summary.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Tags</h4>
                    <TagList tags={session.summary.tags} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between py-2">
                <p className="text-sm text-muted-foreground italic">
                  No summary generated yet
                </p>
                {onGenerateSummary && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateSummary();
                    }}
                    disabled={isGeneratingSummary}
                  >
                    {isGeneratingSummary ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Summary
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetails();
                }}
              >
                View Details
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function SessionCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="w-20 h-[45px] rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
