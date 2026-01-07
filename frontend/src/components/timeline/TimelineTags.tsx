import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from 'lucide-react';
import type { SessionSummary } from '@/types';

interface TimelineTagsProps {
  sessions: SessionSummary[] | undefined;
  isLoading: boolean;
  selectedTag: string | null;
  onTagClick: (tag: string) => void;
}

interface TagCount {
  tag: string;
  count: number;
}

function extractTags(sessions: SessionSummary[]): TagCount[] {
  if (!sessions || sessions.length === 0) {
    return [];
  }

  // Collect all tags from sessions with summaries
  const tagCounts = new Map<string, number>();

  sessions.forEach(session => {
    if (session.tags && session.tags.length > 0) {
      session.tags.forEach(tag => {
        const normalizedTag = tag.trim();
        if (normalizedTag) {
          tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
        }
      });
    }
  });

  // Convert to array and sort by count (descending)
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function TimelineTags({ sessions, isLoading, selectedTag, onTagClick }: TimelineTagsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  const tags = extractTags(sessions || []);

  if (tags.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No tags for this date</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Tags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {tags.map(({ tag, count }) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className={`
              w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md
              text-sm transition-colors
              ${selectedTag === tag
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
              }
            `}
          >
            <span className="truncate">{tag}</span>
            <Badge
              variant={selectedTag === tag ? 'secondary' : 'outline'}
              className="ml-auto shrink-0"
            >
              {count}
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export function TimelineTagsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Tags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
      </CardContent>
    </Card>
  );
}
