import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Tag color mapping
const TAG_COLORS: Record<string, string> = {
  coding: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  development: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  research: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  documentation: 'bg-green-500/10 text-green-600 border-green-500/20',
  meetings: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  communication: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  design: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  testing: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  debugging: 'bg-red-500/10 text-red-600 border-red-500/20',
  review: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  planning: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
};

interface TagBadgeProps extends Omit<BadgeProps, 'variant'> {
  tag: string;
}

export function TagBadge({ tag, className, ...props }: TagBadgeProps) {
  const colorClass = TAG_COLORS[tag.toLowerCase()] || 'bg-muted text-muted-foreground';

  return (
    <Badge
      variant="outline"
      className={cn('border', colorClass, className)}
      {...props}
    >
      {tag}
    </Badge>
  );
}

interface TagListProps {
  tags: string[];
  max?: number;
  className?: string;
}

export function TagList({ tags, max = 5, className }: TagListProps) {
  const displayTags = max ? tags.slice(0, max) : tags;
  const remaining = tags.length - displayTags.length;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {displayTags.map((tag) => (
        <TagBadge key={tag} tag={tag} />
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-muted-foreground">
          +{remaining}
        </Badge>
      )}
    </div>
  );
}
