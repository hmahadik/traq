import { ReactNode } from 'react';
import { Check } from 'lucide-react';

interface TimelineListItemProps {
  icon: ReactNode;
  title: string;
  details?: string;
  duration?: string;
  timestamp: number;
  metadata?: ReactNode;
  children?: ReactNode; // For screenshot thumbnails
  onClick?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  onDoubleClick?: () => void;
  dataActivityId?: number;
  selectable?: boolean; // Show checkbox for selection
  reserveCheckboxSpace?: boolean; // Reserve space for checkbox alignment even if not selectable
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
  selectable = false,
  reserveCheckboxSpace = false,
}: TimelineListItemProps) {
  const formattedTime = new Date(timestamp * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const showCheckbox = selectable || reserveCheckboxSpace;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-accent/30 transition-colors text-xs ${onClick ? 'cursor-pointer select-none' : ''} ${
        isSelected ? 'bg-blue-500/10' : ''
      }`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-activity-id={dataActivityId}
      aria-selected={isSelected}
    >
      {/* Checkbox for selectable items, or empty space for alignment */}
      {showCheckbox && (
        <div
          className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
            selectable
              ? isSelected
                ? 'bg-blue-500 border-blue-500'
                : 'border-muted-foreground/40 hover:border-muted-foreground'
              : 'border-transparent' // Invisible placeholder for alignment
          }`}
        >
          {selectable && isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </div>
      )}

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
