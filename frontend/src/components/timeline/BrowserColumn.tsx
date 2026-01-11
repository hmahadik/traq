import React from 'react';
import { Globe, ExternalLink, Chrome, Link as LinkIcon } from 'lucide-react';
import { GRID_CONSTANTS, BrowserEventDisplay } from '@/types/timeline';

interface BrowserColumnProps {
  browserEvents: { [hour: number]: BrowserEventDisplay[] };
  hours: number[]; // Array of hours for grid alignment
  onVisitClick?: (event: BrowserEventDisplay) => void;
}

export const BrowserColumn: React.FC<BrowserColumnProps> = ({
  browserEvents,
  hours,
  onVisitClick,
}) => {
  // Calculate total browser visits for the day
  const totalVisits = Object.values(browserEvents).reduce((sum, events) => sum + events.length, 0);

  // Get icon for browser type
  const getBrowserIcon = (browser: string) => {
    switch (browser.toLowerCase()) {
      case 'chrome':
      case 'chromium':
        return Chrome;
      case 'firefox':
        return Globe;
      case 'safari':
        return Globe;
      case 'edge':
        return Globe;
      default:
        return Globe;
    }
  };

  // Get color for browser type
  const getBrowserColor = (browser: string): { bg: string; border: string; icon: string } => {
    switch (browser.toLowerCase()) {
      case 'chrome':
      case 'chromium':
        return {
          bg: 'bg-cyan-100 dark:bg-cyan-900/30',
          border: 'border-cyan-300 dark:border-cyan-700',
          icon: 'text-cyan-600 dark:text-cyan-400',
        };
      case 'firefox':
        return {
          bg: 'bg-orange-100 dark:bg-orange-900/30',
          border: 'border-orange-300 dark:border-orange-700',
          icon: 'text-orange-600 dark:text-orange-400',
        };
      case 'safari':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          border: 'border-blue-300 dark:border-blue-700',
          icon: 'text-blue-600 dark:text-blue-400',
        };
      case 'edge':
        return {
          bg: 'bg-teal-100 dark:bg-teal-900/30',
          border: 'border-teal-300 dark:border-teal-700',
          icon: 'text-teal-600 dark:text-teal-400',
        };
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-900/30',
          border: 'border-gray-300 dark:border-gray-700',
          icon: 'text-gray-600 dark:text-gray-400',
        };
    }
  };

  // Format visit duration
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  // Truncate title for display
  const truncateTitle = (title: string, maxLength: number = 40): string => {
    if (!title) return '(No title)';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  // Truncate domain for display
  const truncateDomain = (domain: string, maxLength: number = 35): string => {
    if (domain.length <= maxLength) return domain;
    return domain.substring(0, maxLength) + '...';
  };

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          {/* Browser icon */}
          <div className="w-5 h-5 rounded bg-cyan-500 flex items-center justify-center flex-shrink-0">
            <Globe className="w-3 h-3 text-white" />
          </div>
          {/* Column name */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">Browser</div>
          </div>
          {/* Total visits badge */}
          <div className="text-[11px] text-muted-foreground font-medium">
            {totalVisits} {totalVisits === 1 ? 'visit' : 'visits'}
          </div>
        </div>
      </div>

      {/* Hour Blocks with Browser Visits */}
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

        {/* Browser Visit Blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {Object.entries(browserEvents).map(([hour, events]) =>
            events.map((event) => {
              // Calculate position relative to the first hour in the display
              const firstHour = hours[0];
              const hourIndex = parseInt(hour) - firstHour;
              const top = hourIndex * GRID_CONSTANTS.HOUR_HEIGHT_PX + event.pixelPosition;

              const BrowserIcon = getBrowserIcon(event.browser);
              const colors = getBrowserColor(event.browser);

              return (
                <div
                  key={event.id}
                  className="absolute left-0 right-0 mx-2 cursor-pointer hover:shadow-md transition-shadow"
                  style={{
                    top: `${top}px`,
                    minHeight: '32px',
                  }}
                  onClick={() => onVisitClick?.(event)}
                >
                  <div className={`${colors.bg} border ${colors.border} rounded-md px-2 py-1.5`}>
                    {/* Browser visit header */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <BrowserIcon className={`w-3 h-3 ${colors.icon} flex-shrink-0`} />
                      <span className={`text-[10px] font-medium ${colors.icon} uppercase tracking-wide`}>
                        {event.browser}
                      </span>
                      <ExternalLink className="w-2.5 h-2.5 text-muted-foreground ml-auto" />
                    </div>

                    {/* Page title */}
                    <div className="text-[11px] text-foreground line-clamp-2 leading-tight mb-1 font-medium">
                      {truncateTitle(event.title)}
                    </div>

                    {/* Domain and duration */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <LinkIcon className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="truncate flex-1">
                        {truncateDomain(event.domain)}
                      </span>
                      {event.visitDurationSeconds > 0 && (
                        <span className="flex-shrink-0 font-mono">
                          {formatDuration(event.visitDurationSeconds)}
                        </span>
                      )}
                    </div>
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
