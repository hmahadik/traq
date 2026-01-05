import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TagList } from '@/components/common/TagBadge';
import { ConfidenceBadge } from '@/components/common/ConfidenceBadge';
import { formatTimeRange, formatDuration, cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Camera,
  Clock,
  ExternalLink,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { SessionSummary, Screenshot } from '@/types';

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
  const remainingCount = thumbnails.length - 6;

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
                className="flex-shrink-0 w-20 aspect-video rounded overflow-hidden bg-muted"
              >
                <img
                  src={`https://via.placeholder.com/160x90/1a1a2e/16213e?text=${thumb.id}`}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="flex-shrink-0 w-20 aspect-video rounded bg-muted flex items-center justify-center">
                <span className="text-sm text-muted-foreground">+{remainingCount}</span>
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
            <Skeleton key={i} className="w-20 aspect-video rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
