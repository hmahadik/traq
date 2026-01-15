import React from 'react';
import { File, FileText, FilePlus, FileX, FileEdit, FolderOpen, Copy, Clock } from 'lucide-react';
import { GRID_CONSTANTS, FileEventDisplay } from '@/types/timeline';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FilesColumnProps {
  fileEvents: { [hour: number]: FileEventDisplay[] };
  hours: number[]; // Array of hours for grid alignment
  onFileClick?: (event: FileEventDisplay) => void;
  hourHeight?: number;
  lassoPreviewKeys?: Set<string>;
  selectedEventKeys?: Set<string>;
}

export const FilesColumn: React.FC<FilesColumnProps> = ({
  fileEvents,
  hours,
  onFileClick,
  hourHeight,
  lassoPreviewKeys,
  selectedEventKeys,
}) => {
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;
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
      {/* Column Header - Fixed height */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1 min-w-0 truncate text-xs font-medium text-foreground">Files</div>
          <div className="text-[10px] text-muted-foreground flex-shrink-0">{totalEvents}</div>
        </div>
      </div>

      {/* Hour Blocks with File Events */}
      <div className="relative bg-card">
        {hours.map((hour, index) => (
          <div
            key={hour}
            className={`relative border-b border-border ${
              index % 2 === 0 ? 'bg-card' : 'bg-muted/30'
            }`}
            style={{ height: `${effectiveHourHeight}px` }}
          />
        ))}

        {/* File Event Blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {Object.entries(fileEvents).map(([hour, events]) =>
            events.map((event) => {
              // Calculate position relative to the first hour in the display
              const firstHour = hours[0];
              const hourIndex = parseInt(hour) - firstHour;
              const top = hourIndex * effectiveHourHeight + event.pixelPosition;

              const EventIcon = getEventIcon(event.eventType);
              const colors = getEventColor(event.eventType);

              // Format time for tooltip
              const formatTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              });

              // Full path
              const fullPath = event.directory ? `${event.directory}/${event.fileName}` : event.fileName;

              // Copy path to clipboard
              const copyPath = (e: React.MouseEvent) => {
                e.stopPropagation();
                navigator.clipboard.writeText(fullPath);
              };

              // Check if this event is in the lasso preview or selected
              const key = `file:${event.id}`;
              const isHighlighted = lassoPreviewKeys?.has(key) || selectedEventKeys?.has(key);

              return (
                <TooltipProvider key={event.id} delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`absolute left-0 right-0 mx-1 cursor-pointer hover:shadow-md transition-shadow ${
                          isHighlighted ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                        }`}
                        style={{
                          top: `${top}px`,
                          minHeight: '28px',
                        }}
                        data-event-key={`file:${event.id}`}
                        onClick={() => onFileClick?.(event)}
                      >
                        <div className={`${colors.bg} border ${colors.border} rounded-md px-2 py-1 overflow-hidden`}>
                          {/* File event header */}
                          <div className="flex items-center gap-1">
                            <EventIcon className={`w-3 h-3 ${colors.icon} flex-shrink-0`} />
                            <span className={`text-[9px] font-medium ${colors.icon} uppercase`}>
                              {event.eventType}
                            </span>
                            <span className="text-[10px] text-foreground truncate flex-1">
                              {event.fileName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-md p-3">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-center gap-2">
                          <EventIcon className={`w-4 h-4 ${colors.icon}`} />
                          <span className={`font-semibold text-sm ${colors.icon} uppercase`}>
                            {event.eventType}
                          </span>
                          {event.fileExtension && (
                            <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                              .{event.fileExtension}
                            </span>
                          )}
                        </div>

                        {/* File name */}
                        <div className="text-sm font-medium text-foreground">
                          {event.fileName}
                        </div>

                        {/* Full path with copy */}
                        <div className="relative">
                          <div className="text-xs font-mono bg-muted p-2 rounded pr-8 break-all">
                            {fullPath}
                          </div>
                          <button
                            onClick={copyPath}
                            className="absolute top-1 right-1 p-1 hover:bg-background rounded transition-colors"
                            title="Copy path"
                          >
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(event.timestamp)}
                          </span>
                          {event.fileSizeBytes > 0 && (
                            <span>Size: {formatFileSize(event.fileSizeBytes)}</span>
                          )}
                        </div>

                        {/* Old path for rename events */}
                        {event.oldPath && (
                          <div className="pt-2 border-t border-border">
                            <div className="text-[10px] uppercase text-muted-foreground mb-1">Renamed from</div>
                            <div className="text-xs font-mono text-muted-foreground break-all">
                              {event.oldPath}
                            </div>
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
