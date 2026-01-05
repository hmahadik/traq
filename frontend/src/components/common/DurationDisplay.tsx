import { cn, formatDuration } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface DurationDisplayProps {
  seconds: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DurationDisplay({
  seconds,
  showIcon = false,
  size = 'md',
  className,
}: DurationDisplayProps) {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Clock className={cn('text-muted-foreground', iconSizes[size])} />}
      {formatDuration(seconds)}
    </span>
  );
}
