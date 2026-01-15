import { ReactNode } from 'react';

interface TimelineListItemProps {
  icon: ReactNode;
  title: string;
  details?: string;
  duration?: string;
  timestamp: number;
  metadata?: ReactNode;
  children?: ReactNode; // For screenshot thumbnails
  onClick?: () => void;
  isSelected?: boolean;
  onDoubleClick?: () => void;
  dataActivityId?: number;
}

export function TimelineListItem({
  icon,
  title,
  details,
  duration,
  timestamp,
  metadata,
  children,
  onClick,
  isSelected = false,
  onDoubleClick,
  dataActivityId,
}: TimelineListItemProps) {
  const formattedTime = new Date(timestamp * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-accent/30 transition-colors text-xs ${onClick ? 'cursor-pointer' : ''} ${
        isSelected ? 'bg-blue-500/10 ring-1 ring-blue-500 ring-inset' : ''
      }`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-activity-id={dataActivityId}
      aria-selected={isSelected}
    >
      {/* Time */}
      <div className="w-16 flex-shrink-0 text-muted-foreground font-mono">{formattedTime}</div>

      {/* Icon */}
      <div className="flex-shrink-0">{icon}</div>

      {/* Title */}
      <div className="min-w-[120px] font-medium truncate">{title}</div>

      {/* Details */}
      <div className="flex-1 min-w-0 text-muted-foreground truncate">{details}</div>

      {/* Metadata */}
      {metadata && <div className="flex-shrink-0">{metadata}</div>}

      {/* Duration */}
      {duration && <div className="w-12 flex-shrink-0 text-right text-muted-foreground font-medium">{duration}</div>}

      {/* Children */}
      {children}
    </div>
  );
}
