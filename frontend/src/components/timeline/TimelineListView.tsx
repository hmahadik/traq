import { useMemo } from 'react';
import type { TimelineGridData, TimelineListEvent, ActivityBlock, SessionSummaryWithPosition, GitEventDisplay, ShellEventDisplay, FileEventDisplay, BrowserEventDisplay, AFKBlock } from '@/types/timeline';
import type { TimelineFilters } from './FilterControls';
import { flattenTimelineData } from '@/utils/timelineHelpers';
import { ActivityListItem } from './ActivityListItem';
import { SessionListItem } from './SessionListItem';
import { GitListItem } from './GitListItem';
import { ShellListItem } from './ShellListItem';
import { FileListItem } from './FileListItem';
import { BrowserListItem } from './BrowserListItem';
import { AFKListItem } from './AFKListItem';

interface TimelineListViewProps {
  data: TimelineGridData;
  filters: TimelineFilters;
  onSessionClick?: (sessionId: number) => void;
  // Selection props
  selectedActivityIds?: Set<number>;
  onActivitySelect?: (id: number, event: React.MouseEvent, orderedIds: number[]) => void;
  onActivityDoubleClick?: (activity: ActivityBlock) => void;
}

interface GroupedEvents {
  hour: number;
  events: TimelineListEvent[];
}

export function TimelineListView({
  data,
  filters,
  onSessionClick,
  selectedActivityIds,
  onActivitySelect,
  onActivityDoubleClick,
}: TimelineListViewProps) {
  // Flatten grid data into chronological list
  const allEvents = useMemo(() => flattenTimelineData(data), [data]);

  // Get ordered list of activity IDs for range selection
  const orderedActivityIds = useMemo(() => {
    return allEvents
      .filter((e) => e.type === 'activity')
      .map((e) => (e.data as ActivityBlock).id);
  }, [allEvents]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      switch (event.type) {
        case 'git':
          return filters.showGit;
        case 'shell':
          return filters.showShell;
        case 'file':
          return filters.showFiles;
        case 'browser':
          return filters.showBrowser;
        case 'activity':
        case 'session':
        case 'afk':
          return true; // Always show activities, sessions, and AFK
        default:
          return true;
      }
    });
  }, [allEvents, filters]);

  // Group events by hour
  const groupedEvents = useMemo(() => {
    const groups: GroupedEvents[] = [];
    let currentHour = -1;
    let currentGroup: GroupedEvents | null = null;

    filteredEvents.forEach((event) => {
      const eventDate = new Date(event.timestamp * 1000);
      const eventHour = eventDate.getHours();

      if (eventHour !== currentHour) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentHour = eventHour;
        currentGroup = { hour: eventHour, events: [event] };
      } else if (currentGroup) {
        currentGroup.events.push(event);
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [filteredEvents]);

  // Empty state
  if (filteredEvents.length === 0) {
    if (allEvents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p className="text-sm">No activity for this day</p>
          <p className="text-xs mt-1">Start tracking to see your timeline</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No events match your filters</p>
        <p className="text-xs mt-1">Adjust filters to see more events</p>
      </div>
    );
  }

  // Render appropriate component based on event type
  const renderEvent = (event: TimelineListEvent) => {
    switch (event.type) {
      case 'activity': {
        const activity = event.data as ActivityBlock;
        return (
          <ActivityListItem
            activity={activity}
            isSelected={selectedActivityIds?.has(activity.id)}
            onClick={onActivitySelect ? (e) => onActivitySelect(activity.id, e, orderedActivityIds) : undefined}
            onDoubleClick={onActivityDoubleClick ? () => onActivityDoubleClick(activity) : undefined}
          />
        );
      }
      case 'session':
        return <SessionListItem session={event.data as SessionSummaryWithPosition} onClick={onSessionClick} />;
      case 'git':
        return <GitListItem gitEvent={event.data as GitEventDisplay} />;
      case 'shell':
        return <ShellListItem shellEvent={event.data as ShellEventDisplay} />;
      case 'file':
        return <FileListItem fileEvent={event.data as FileEventDisplay} />;
      case 'browser':
        return <BrowserListItem browserEvent={event.data as BrowserEventDisplay} />;
      case 'afk':
        return <AFKListItem afkBlock={event.data as AFKBlock} />;
      default:
        return null;
    }
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${period}`;
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto" data-scroll-container="list">
      <div className="border-t bg-card">
        {groupedEvents.map((group) => (
          <div key={group.hour} data-hour={group.hour}>
            {/* Hour Header */}
            <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b">
              {formatHour(group.hour)} — {group.events.length} events
            </div>
            {/* Events in this hour */}
            {group.events.map((event) => (
              <div key={event.id}>
                {renderEvent(event)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
