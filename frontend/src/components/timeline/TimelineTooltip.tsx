import { useMemo, forwardRef } from 'react';
import { GitCommit, Terminal, Globe, FileText, Coffee, Monitor, Camera, Trash2, Pencil, FolderKanban, Sparkles, X } from 'lucide-react';
import type { EventDot, EventDropType } from './timelineTypes';

interface TimelineTooltipProps {
  event: EventDot | null;
  position: { x: number; y: number } | null;
  onDelete?: (event: EventDot) => void;
  onEdit?: (event: EventDot) => void;
  onViewScreenshot?: (event: EventDot) => void;
  onClose?: () => void;
}

const EVENT_TYPE_ICONS: Record<EventDropType, typeof GitCommit> = {
  activity: Monitor,
  git: GitCommit,
  shell: Terminal,
  browser: Globe,
  file: FileText,
  afk: Coffee,
  screenshot: Camera,
  projects: FolderKanban,
  session: Sparkles,
};

const EVENT_TYPE_LABELS: Record<EventDropType, string> = {
  activity: 'Activity',
  git: 'Git Commit',
  shell: 'Shell Command',
  browser: 'Browser Visit',
  file: 'File Event',
  afk: 'Break',
  screenshot: 'Screenshot',
  projects: 'Project',
  session: 'Session Summary',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(seconds?: number): string | null {
  if (!seconds || seconds < 1) return null;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export const TimelineTooltip = forwardRef<HTMLDivElement, TimelineTooltipProps>(function TimelineTooltip({
  event,
  position,
  onDelete,
  onEdit,
  onClose,
}, ref) {
  const content = useMemo(() => {
    if (!event) return null;

    const Icon = EVENT_TYPE_ICONS[event.type];
    const typeLabel = EVENT_TYPE_LABELS[event.type];
    const duration = formatDuration(event.duration);
    const time = formatTime(event.timestamp);

    // Extract extra details based on event type
    let extraDetails: { label: string; value: string }[] = [];

    switch (event.type) {
      case 'git': {
        const meta = event.metadata as Record<string, unknown>;
        if (meta.repository) {
          extraDetails.push({ label: 'Repo', value: String(meta.repository) });
        }
        if (meta.branch) {
          extraDetails.push({ label: 'Branch', value: String(meta.branch) });
        }
        if (meta.insertions || meta.deletions) {
          const changes = `+${meta.insertions || 0} -${meta.deletions || 0}`;
          extraDetails.push({ label: 'Changes', value: changes });
        }
        break;
      }
      case 'shell': {
        const meta = event.metadata as Record<string, unknown>;
        if (meta.shellType) {
          extraDetails.push({ label: 'Shell', value: String(meta.shellType) });
        }
        if (meta.exitCode !== undefined && meta.exitCode !== 0) {
          extraDetails.push({
            label: 'Exit',
            value: String(meta.exitCode),
          });
        }
        break;
      }
      case 'browser': {
        const meta = event.metadata as Record<string, unknown>;
        if (meta.domain) {
          extraDetails.push({ label: 'Domain', value: String(meta.domain) });
        }
        if (meta.browser) {
          extraDetails.push({ label: 'Browser', value: String(meta.browser) });
        }
        break;
      }
      case 'file': {
        const meta = event.metadata as Record<string, unknown>;
        if (meta.eventType) {
          extraDetails.push({ label: 'Action', value: String(meta.eventType) });
        }
        if (meta.directory) {
          const dir = String(meta.directory);
          const shortDir = dir.length > 30 ? '...' + dir.slice(-27) : dir;
          extraDetails.push({ label: 'Dir', value: shortDir });
        }
        break;
      }
      case 'activity': {
        const meta = event.metadata as Record<string, unknown>;
        if (meta.appName) {
          extraDetails.push({ label: 'App', value: String(meta.appName) });
        }
        if (meta.category) {
          extraDetails.push({
            label: 'Category',
            value: String(meta.category).charAt(0).toUpperCase() + String(meta.category).slice(1),
          });
        }
        break;
      }
      case 'screenshot': {
        const meta = event.metadata as Record<string, unknown>;
        if (meta.appName) {
          extraDetails.push({ label: 'App', value: String(meta.appName) });
        }
        if (meta.windowClass) {
          extraDetails.push({ label: 'Window', value: String(meta.windowClass) });
        }
        break;
      }
      case 'session': {
        const meta = event.metadata as Record<string, unknown>;
        if (meta.category) {
          extraDetails.push({
            label: 'Category',
            value: String(meta.category).charAt(0).toUpperCase() + String(meta.category).slice(1),
          });
        }
        if (meta.topApps && Array.isArray(meta.topApps) && meta.topApps.length > 0) {
          const appNames = meta.topApps.slice(0, 3).map((a: { appName: string }) => a.appName).join(', ');
          extraDetails.push({ label: 'Top Apps', value: appNames });
        }
        if (meta.tags && Array.isArray(meta.tags) && meta.tags.length > 0) {
          extraDetails.push({ label: 'Tags', value: meta.tags.slice(0, 3).join(', ') });
        }
        if (meta.isDraft) {
          extraDetails.push({ label: 'Status', value: String(meta.draftStatus) || 'Draft' });
        }
        break;
      }
    }

    return {
      Icon,
      typeLabel,
      time,
      duration,
      label: event.label,
      color: event.color,
      extraDetails,
    };
  }, [event]);

  if (!content || !position) return null;

  const { Icon, typeLabel, time, duration, label, color, extraDetails } = content;

  // Calculate tooltip position with boundary checks
  // Tooltip dimensions (approximate)
  const tooltipWidth = 250;
  const tooltipHeight = 150;
  const padding = 12;

  // Get viewport dimensions
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

  // Default: position to the right and above the cursor
  let left = position.x + padding;
  let top = position.y - padding;
  let transformY = '-100%';

  // Check right edge overflow - flip to left side
  if (left + tooltipWidth > viewportWidth - padding) {
    left = position.x - padding - tooltipWidth;
  }

  // Check top edge overflow - position below cursor instead
  if (top - tooltipHeight < padding) {
    top = position.y + padding;
    transformY = '0';
  }

  // Ensure left doesn't go negative
  if (left < padding) {
    left = padding;
  }

  const tooltipStyle: React.CSSProperties = {
    left,
    top,
    transform: `translateY(${transformY})`,
  };

  return (
    <div
      ref={ref}
      className="fixed z-50"
      style={tooltipStyle}
    >
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px]">
        {/* Header with icon and type */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ backgroundColor: color }}
          >
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{typeLabel}</span>
          <span className="text-xs text-muted-foreground ml-auto mr-1">{time}</span>
          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Main label */}
        <p className="text-sm font-medium text-foreground truncate mb-1">{label}</p>

        {/* Duration if available */}
        {duration && (
          <p className="text-xs text-muted-foreground mb-2">Duration: {duration}</p>
        )}

        {/* Extra details */}
        {extraDetails.length > 0 && (
          <div className="border-t border-border pt-2 mt-2 space-y-1">
            {extraDetails.map((detail, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{detail.label}:</span>
                <span className="text-foreground truncate">{detail.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons - only show if there are actions available */}
        {(onEdit && event.type === 'activity') || (onDelete && event.type !== 'screenshot') ? (
          <div className="border-t border-border pt-2 mt-2 flex items-center gap-1">
            {/* Edit button - only for activities */}
            {onEdit && event.type === 'activity' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(event);
                }}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Edit activity"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}

            {/* Delete button - not for screenshots (no deletion implemented) */}
            {onDelete && event.type !== 'screenshot' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(event);
                }}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors ml-auto"
                title="Delete event"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
});
