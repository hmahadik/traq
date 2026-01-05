import { cn, formatTimestamp, formatDate, formatTimeRange } from '@/lib/utils';
import { Calendar, Clock } from 'lucide-react';

interface TimeDisplayProps {
  timestamp: number;
  format?: 'time' | 'date' | 'full';
  showIcon?: boolean;
  className?: string;
}

export function TimeDisplay({
  timestamp,
  format = 'time',
  showIcon = false,
  className,
}: TimeDisplayProps) {
  const formatted = format === 'time'
    ? formatTimestamp(timestamp)
    : format === 'date'
    ? formatDate(timestamp)
    : `${formatDate(timestamp)} ${formatTimestamp(timestamp)}`;

  const Icon = format === 'date' ? Calendar : Clock;

  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      {showIcon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      {formatted}
    </span>
  );
}

interface TimeRangeDisplayProps {
  start: number;
  end: number;
  showIcon?: boolean;
  className?: string;
}

export function TimeRangeDisplay({
  start,
  end,
  showIcon = false,
  className,
}: TimeRangeDisplayProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      {showIcon && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
      {formatTimeRange(start, end)}
    </span>
  );
}
