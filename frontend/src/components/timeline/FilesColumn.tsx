import React from 'react';
import { File, FileText, FilePlus, FileX, FileEdit, FolderOpen } from 'lucide-react';
import { GRID_CONSTANTS, FileEventDisplay } from '@/types/timeline';

interface FilesColumnProps {
  fileEvents: { [hour: number]: FileEventDisplay[] };
  hours: number[]; // Array of hours for grid alignment
  onFileClick?: (event: FileEventDisplay) => void;
}

export const FilesColumn: React.FC<FilesColumnProps> = ({
  fileEvents,
  hours,
  onFileClick,
}) => {
  // Calculate total file events for the day
  const totalEvents = Object.values(fileEvents).reduce((sum, events) => sum + events.length, 0);

  // Get icon for event type
  const getEventIcon = (eventType: string) => {
    switch (eventType.toLowerCase()) {
      case 'create':
      case 'created':
        return FilePlus;
      case 'delete':
      case 'deleted':
        return FileX;
      case 'modify':
      case 'modified':
        return FileEdit;
      case 'rename':
      case 'renamed':
        return FileText;
      default:
        return File;
    }
  };

  // Get color for event type
  const getEventColor = (eventType: string): { bg: string; border: string; icon: string } => {
    switch (eventType.toLowerCase()) {
      case 'create':
      case 'created':
        return {
          bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          border: 'border-emerald-300 dark:border-emerald-700',
          icon: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'delete':
      case 'deleted':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          border: 'border-red-300 dark:border-red-700',
          icon: 'text-red-600 dark:text-red-400',
        };
      case 'modify':
      case 'modified':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          border: 'border-blue-300 dark:border-blue-700',
          icon: 'text-blue-600 dark:text-blue-400',
        };
      case 'rename':
      case 'renamed':
        return {
          bg: 'bg-amber-100 dark:bg-amber-900/30',
          border: 'border-amber-300 dark:border-amber-700',
          icon: 'text-amber-600 dark:text-amber-400',
        };
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-900/30',
          border: 'border-gray-300 dark:border-gray-700',
          icon: 'text-gray-600 dark:text-gray-400',
        };
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  };

  // Truncate file path for display
  const truncatePath = (path: string, maxLength: number = 35): string => {
    if (path.length <= maxLength) return path;
    const parts = path.split('/');
    if (parts.length <= 2) return path.substring(0, maxLength) + '...';
    // Show last 2 path segments
    return '.../' + parts.slice(-2).join('/');
  };

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          {/* File icon */}
          <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-3 h-3 text-white" />
          </div>
          {/* Column name */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">Files</div>
          </div>
          {/* Total events badge */}
          <div className="text-[11px] text-muted-foreground font-medium">
            {totalEvents} {totalEvents === 1 ? 'event' : 'events'}
          </div>
        </div>
      </div>

      {/* Hour Blocks with File Events */}
      <div className="relative bg-card">
        {hours.map((hour) => (
          <div
            key={hour}
            className="relative border-b border-border"
            style={{ height: `${GRID_CONSTANTS.HOUR_HEIGHT_PX}px` }}
          >
            {/* Subtle grid pattern for empty state */}
            <div
              className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
                backgroundSize: '8px 8px',
              }}
            />
          </div>
        ))}

        {/* File Event Blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {Object.entries(fileEvents).map(([hour, events]) =>
            events.map((event) => {
              // Calculate position relative to the first hour in the display
              const firstHour = hours[0];
              const hourIndex = parseInt(hour) - firstHour;
              const top = hourIndex * GRID_CONSTANTS.HOUR_HEIGHT_PX + event.pixelPosition;

              const EventIcon = getEventIcon(event.eventType);
              const colors = getEventColor(event.eventType);

              return (
                <div
                  key={event.id}
                  className="absolute left-0 right-0 mx-2 cursor-pointer hover:shadow-md transition-shadow"
                  style={{
                    top: `${top}px`,
                    minHeight: '32px',
                  }}
                  onClick={() => onFileClick?.(event)}
                >
                  <div className={`${colors.bg} border ${colors.border} rounded-md px-2 py-1.5`}>
                    {/* File event header */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <EventIcon className={`w-3 h-3 ${colors.icon} flex-shrink-0`} />
                      <span className={`text-[10px] font-medium ${colors.icon} uppercase tracking-wide`}>
                        {event.eventType}
                      </span>
                      {event.fileExtension && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          .{event.fileExtension}
                        </span>
                      )}
                    </div>

                    {/* File name */}
                    <div className="text-[11px] text-foreground line-clamp-2 leading-tight mb-1 font-medium">
                      {event.fileName}
                    </div>

                    {/* Directory and size */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {event.directory && (
                        <span className="truncate flex-1">
                          {truncatePath(event.directory, 25)}
                        </span>
                      )}
                      {event.fileSizeBytes > 0 && (
                        <span className="flex-shrink-0 font-mono">
                          {formatFileSize(event.fileSizeBytes)}
                        </span>
                      )}
                    </div>

                    {/* Old path for rename events */}
                    {event.oldPath && (
                      <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
                        <span>from:</span>
                        <span className="truncate font-mono">{truncatePath(event.oldPath, 28)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
