import React, { useMemo } from 'react';
import { Globe, ExternalLink, Chrome, Link as LinkIcon } from 'lucide-react';
import { GRID_CONSTANTS, BrowserEventDisplay } from '@/types/timeline';
import { groupBrowserEventsByDomain, GroupedBrowserEvent } from '@/utils/timelineHelpers';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BrowserColumnProps {
  browserEvents: { [hour: number]: BrowserEventDisplay[] };
  hours: number[]; // Array of hours for grid alignment
  onVisitClick?: (event: BrowserEventDisplay) => void;
  hourHeight?: number;
  lassoPreviewKeys?: Set<string>;
  selectedEventKeys?: Set<string>;
}

export const BrowserColumn: React.FC<BrowserColumnProps> = ({
  browserEvents,
  hours,
  onVisitClick,
  hourHeight,
  lassoPreviewKeys,
  selectedEventKeys,
}) => {
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;

  // Flatten and group all browser events by domain
  const groupedEvents = useMemo(() => {
    const allEvents: BrowserEventDisplay[] = [];
    Object.values(browserEvents).forEach(events => {
      allEvents.push(...events);
    });
    const grouped = groupBrowserEventsByDomain(allEvents, 900); // 15 min gap threshold
    console.log(`[BrowserColumn] ${allEvents.length} events -> ${grouped.length} grouped`);
    return grouped;
  }, [browserEvents]);

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
      {/* Column Header - Fixed height */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="w-5 h-5 rounded bg-cyan-500 flex items-center justify-center flex-shrink-0">
            <Globe className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1 min-w-0 truncate text-xs font-medium text-foreground">Browser</div>
          <div className="text-[10px] text-muted-foreground flex-shrink-0">{totalVisits}</div>
        </div>
      </div>

      {/* Hour Blocks with Browser Visits */}
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

        {/* Grouped Browser Visit Blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {groupedEvents.map((event) => {
            // Calculate position based on startTimestamp
            const startDate = new Date(event.startTimestamp * 1000);
            const eventHour = startDate.getHours();
            const eventMinute = startDate.getMinutes();
            const firstHour = hours[0];
            const hourIndex = eventHour - firstHour;
            const minuteFraction = eventMinute / 60;
            const top = (hourIndex * effectiveHourHeight) + (minuteFraction * effectiveHourHeight);

            // Calculate height based on total duration
            const durationHours = event.totalDurationSeconds / 3600;
            const height = Math.max(32, durationHours * effectiveHourHeight);

            const BrowserIcon = getBrowserIcon(event.browser);
            const colors = getBrowserColor(event.browser);

            // Check if any event in this group is in the lasso preview or selected
            const isHighlighted = event.eventIds.some(id => {
              const key = `browser:${id}`;
              return lassoPreviewKeys?.has(key) || selectedEventKeys?.has(key);
            });

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
                        height: `${height}px`,
                      }}
                      data-event-keys={JSON.stringify(event.eventIds.map(id => `browser:${id}`))}
                      onClick={() => onVisitClick?.(event as unknown as BrowserEventDisplay)}
                    >
                      <div className={`${colors.bg} border ${colors.border} rounded-md px-2 py-1 h-full overflow-hidden`}>
                        {/* Header with domain/sites count */}
                        <div className="flex items-center gap-1">
                          <BrowserIcon className={`w-3 h-3 ${colors.icon} flex-shrink-0`} />
                          <span className="text-[10px] font-medium text-foreground truncate flex-1">
                            {event.mergedDomains && event.mergedDomains.length > 1
                              ? `${event.mergedDomains.length} sites`
                              : truncateDomain(event.domain, 15)}
                          </span>
                          <span className="text-[9px] text-muted-foreground flex-shrink-0">
                            {event.mergedCount}
                          </span>
                        </div>
                        {/* Duration - only show if tall enough */}
                        {height >= 40 && (
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {formatDuration(event.totalDurationSeconds)}
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-sm p-3">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center gap-2">
                        <BrowserIcon className={`w-4 h-4 ${colors.icon}`} />
                        <span className="font-semibold text-sm">
                          {event.mergedDomains && event.mergedDomains.length > 1
                            ? `${event.mergedDomains.length} Sites`
                            : event.domain}
                        </span>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{event.mergedCount} page{event.mergedCount > 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>{formatDuration(event.totalDurationSeconds)}</span>
                        <span>•</span>
                        <span>{new Date(event.startTimestamp * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                      </div>

                      {/* Domains list (if multiple) */}
                      {event.mergedDomains && event.mergedDomains.length > 1 && (
                        <div className="space-y-1 pt-1 border-t border-border">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                            Sites visited
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {event.mergedDomains.slice(0, 8).map((domain, idx) => (
                              <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
                                {domain}
                              </span>
                            ))}
                            {event.mergedDomains.length > 8 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{event.mergedDomains.length - 8} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Current/most recent URL - clickable */}
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate">{event.url}</span>
                      </a>

                      {/* Page titles */}
                      {event.mergedTitles.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-border">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                            Pages ({event.mergedTitles.length})
                          </div>
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {event.mergedTitles.slice(0, 5).map((title, idx) => (
                              <div key={idx} className="text-[11px] text-foreground/80 leading-tight truncate">
                                {title || '(Untitled)'}
                              </div>
                            ))}
                            {event.mergedTitles.length > 5 && (
                              <div className="text-[10px] text-muted-foreground/70 italic">
                                +{event.mergedTitles.length - 5} more...
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    </div>
  );
};
