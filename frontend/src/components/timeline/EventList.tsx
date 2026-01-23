// frontend/src/components/timeline/EventList.tsx
// Consolidated event list component combining best features of TimelineListView and Timeline embedded list

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  TimelineGridData,
  ListViewSort,
} from '@/types/timeline';
import type { EventDot, EventDropType } from './timelineTypes';
import type { EventKey } from '@/utils/eventKeys';
import { makeEventKey } from '@/utils/eventKeys';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn, formatDuration } from '@/lib/utils';
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Search,
  Pencil,
  Trash2,
  FolderKanban,
  GitCommit,
  Terminal,
  Globe,
  FileText,
  Coffee,
  Monitor,
  Camera,
  Play,
  Merge,
  Check,
  X,
  Filter,
  List,
} from 'lucide-react';
import { useProjects } from '@/api/hooks';
import type { Project } from '@/api/client';

const LIST_COLLAPSED_KEY = 'eventlist-collapsed';

// Icon map for event types
const EVENT_TYPE_ICONS: Record<EventDropType, typeof GitCommit> = {
  activity: Monitor,
  git: GitCommit,
  shell: Terminal,
  browser: Globe,
  file: FileText,
  afk: Coffee,
  screenshot: Camera,
  projects: FolderKanban,
};

interface EventListProps {
  // Data - provide either events directly OR gridData to transform
  events?: EventDot[];
  gridData?: TimelineGridData;

  // Playhead for ordering
  playheadTimestamp?: Date | null;

  // Selection
  selectedIds?: Set<EventKey>;
  onSelectionChange?: (ids: Set<EventKey>) => void;

  // Actions
  onEventEdit?: (event: EventDot) => void;
  onEventDelete?: (ids: Set<EventKey>) => void;
  onAssignProject?: (ids: Set<EventKey>, projectId: number) => void;
  onMerge?: (ids: Set<EventKey>) => void;
  onAcceptDrafts?: (ids: Set<EventKey>) => void;

  // Display
  maxItems?: number;
  className?: string;

  // Collapse state - can be controlled externally
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

// Convert TimelineGridData to EventDot array (similar to useTimelineData but simpler)
function gridDataToEvents(data: TimelineGridData | undefined): EventDot[] {
  if (!data) return [];

  const events: EventDot[] = [];

  // Activities from hourlyGrid
  Object.entries(data.hourlyGrid).forEach(([_hour, apps]) => {
    Object.entries(apps).forEach(([_appName, blocks]) => {
      blocks.forEach((block) => {
        events.push({
          id: makeEventKey('activity', block.id),
          originalId: block.id,
          timestamp: new Date(block.startTime * 1000),
          type: 'activity',
          row: block.appName,
          label: block.windowTitle || block.appName,
          duration: block.durationSeconds,
          color: '#3b82f6',
          metadata: {
            appName: block.appName,
            windowTitle: block.windowTitle,
            category: block.category,
            projectId: block.projectId,
            projectColor: block.projectColor,
            projectName: block.projectName,
          },
        });
      });
    });
  });

  // Git events
  Object.values(data.gitEvents).flat().forEach((evt) => {
    events.push({
      id: makeEventKey('git', evt.id),
      originalId: evt.id,
      timestamp: new Date(evt.timestamp * 1000),
      type: 'git',
      row: 'Git',
      label: evt.messageSubject,
      color: '#22c55e',
      metadata: {
        repository: evt.repository,
        branch: evt.branch,
        shortHash: evt.shortHash,
      },
    });
  });

  // Shell events
  Object.values(data.shellEvents).flat().forEach((evt) => {
    events.push({
      id: makeEventKey('shell', evt.id),
      originalId: evt.id,
      timestamp: new Date(evt.timestamp * 1000),
      type: 'shell',
      row: 'Terminal',
      label: evt.command,
      duration: evt.durationSeconds,
      color: '#64748b',
      metadata: {
        workingDirectory: evt.workingDirectory,
        shellType: evt.shellType,
        exitCode: evt.exitCode,
      },
    });
  });

  // Browser events
  Object.values(data.browserEvents).flat().forEach((evt) => {
    events.push({
      id: makeEventKey('browser', evt.id),
      originalId: evt.id,
      timestamp: new Date(evt.timestamp * 1000),
      type: 'browser',
      row: evt.browser,
      label: evt.title,
      duration: evt.visitDurationSeconds,
      color: '#10b981',
      metadata: {
        url: evt.url,
        domain: evt.domain,
        browser: evt.browser,
      },
    });
  });

  // File events
  Object.values(data.fileEvents).flat().forEach((evt) => {
    events.push({
      id: makeEventKey('file', evt.id),
      originalId: evt.id,
      timestamp: new Date(evt.timestamp * 1000),
      type: 'file',
      row: 'Files',
      label: evt.fileName,
      color: '#f59e0b',
      metadata: {
        eventType: evt.eventType,
        directory: evt.directory,
        filePath: evt.filePath,
      },
    });
  });

  // AFK events
  Object.values(data.afkBlocks).flat().forEach((evt) => {
    events.push({
      id: makeEventKey('afk', evt.id),
      originalId: evt.id,
      timestamp: new Date(evt.startTime * 1000),
      type: 'afk',
      row: 'Breaks',
      label: 'Away from keyboard',
      duration: evt.durationSeconds,
      color: '#f97316',
      metadata: {
        triggerType: evt.triggerType,
      },
    });
  });

  return events;
}

type SortColumn = 'time' | 'duration' | 'app' | 'title';
type SortMode = 'playhead' | 'column';

export function EventList({
  events: eventsProp,
  gridData,
  playheadTimestamp,
  selectedIds = new Set(),
  onSelectionChange,
  onEventEdit,
  onEventDelete,
  onAssignProject,
  onMerge,
  onAcceptDrafts,
  maxItems = 100,
  className,
  collapsed: collapsedProp,
  onCollapsedChange,
}: EventListProps) {
  // Internal collapsed state with localStorage persistence (used when not controlled)
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(LIST_COLLAPSED_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Use prop if controlled, otherwise internal state
  const isControlled = collapsedProp !== undefined;
  const collapsed = isControlled ? collapsedProp : internalCollapsed;

  const setCollapsed = useCallback((value: boolean) => {
    if (onCollapsedChange) {
      onCollapsedChange(value);
    }
    if (!isControlled) {
      setInternalCollapsed(value);
    }
  }, [isControlled, onCollapsedChange]);

  // Persist collapsed state
  useEffect(() => {
    try {
      localStorage.setItem(LIST_COLLAPSED_KEY, collapsed.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [collapsed]);

  // Fetch projects for assign dropdown and project name lookup
  const { data: projects } = useProjects();

  // Build projects map for quick lookup
  const projectsMap = useMemo(() => {
    const map = new Map<number, Project>();
    if (projects) {
      (projects as Project[]).forEach((p) => map.set(p.id, p));
    }
    return map;
  }, [projects]);

  // Use events prop if provided, otherwise transform gridData
  const rawEvents = useMemo(() => {
    if (eventsProp) {
      // If events prop provided, enrich with project names from projectsMap
      return eventsProp.map((event) => {
        if (event.metadata?.projectId && !event.metadata?.projectName) {
          const project = projectsMap.get(event.metadata.projectId);
          if (project) {
            return {
              ...event,
              metadata: {
                ...event.metadata,
                projectName: project.name,
                projectColor: project.color,
              },
            };
          }
        }
        return event;
      });
    }
    // gridData already includes projectName from backend
    return gridDataToEvents(gridData);
  }, [eventsProp, gridData, projectsMap]);

  // Get unique apps for filter dropdown
  const uniqueApps = useMemo(() => {
    const apps = new Set<string>();
    rawEvents.forEach((e) => apps.add(e.row));
    return Array.from(apps).sort();
  }, [rawEvents]);

  // Sorting and filter state
  const [sortMode, setSortMode] = useState<SortMode>('playhead');
  const [columnSort, setColumnSort] = useState<ListViewSort>({ column: 'time', direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const lastSelectedIndex = useRef<number | null>(null);

  // Filter events by search query and selected apps
  const filteredEvents = useMemo(() => {
    let events = rawEvents;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      events = events.filter((event) =>
        event.label.toLowerCase().includes(query) ||
        event.row.toLowerCase().includes(query)
      );
    }

    // Filter by selected apps
    if (selectedApps.size > 0) {
      events = events.filter((event) => selectedApps.has(event.row));
    }

    return events;
  }, [rawEvents, searchQuery, selectedApps]);

  // Sort events based on mode
  const sortedEvents = useMemo(() => {
    const events = [...filteredEvents];

    if (sortMode === 'playhead' && playheadTimestamp) {
      // Playhead-aware ordering: events from playhead forward first, then earlier in reverse
      const playheadTime = playheadTimestamp.getTime();

      const afterPlayhead = events
        .filter((e) => e.timestamp.getTime() >= playheadTime)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const beforePlayhead = events
        .filter((e) => e.timestamp.getTime() < playheadTime)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return [...afterPlayhead, ...beforePlayhead];
    }

    // Column sorting
    events.sort((a, b) => {
      let cmp = 0;
      switch (columnSort.column) {
        case 'time':
          cmp = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'duration':
          cmp = (a.duration || 0) - (b.duration || 0);
          break;
        case 'app':
          cmp = a.row.localeCompare(b.row);
          break;
        case 'title':
          cmp = a.label.localeCompare(b.label);
          break;
      }
      return columnSort.direction === 'asc' ? cmp : -cmp;
    });

    return events;
  }, [filteredEvents, sortMode, playheadTimestamp, columnSort]);

  // Limit display
  const displayEvents = sortedEvents.slice(0, maxItems);
  const hasMore = sortedEvents.length > maxItems;

  // Toggle column sort
  const handleColumnSort = (column: SortColumn) => {
    if (sortMode === 'playhead' || columnSort.column !== column) {
      // Switch to column mode or change column
      setSortMode('column');
      setColumnSort({ column, direction: 'asc' });
    } else {
      // Toggle direction
      setColumnSort((prev) => ({
        column,
        direction: prev.direction === 'asc' ? 'desc' : 'asc',
      }));
    }
  };

  // Return to playhead mode
  const handlePlayheadMode = () => {
    setSortMode('playhead');
  };

  // Toggle app filter
  const toggleAppFilter = (app: string) => {
    setSelectedApps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(app)) {
        newSet.delete(app);
      } else {
        newSet.add(app);
      }
      return newSet;
    });
  };

  // Clear app filters
  const clearAppFilters = () => {
    setSelectedApps(new Set());
  };

  // Selection handlers
  const toggleSelection = useCallback(
    (id: EventKey, index: number, shiftKey: boolean) => {
      if (!onSelectionChange) return;

      const newSelection = new Set(selectedIds);

      if (shiftKey && lastSelectedIndex.current !== null) {
        // Range selection
        const start = Math.min(lastSelectedIndex.current, index);
        const end = Math.max(lastSelectedIndex.current, index);
        for (let i = start; i <= end; i++) {
          newSelection.add(displayEvents[i].id);
        }
      } else {
        // Toggle single selection
        if (newSelection.has(id)) {
          newSelection.delete(id);
        } else {
          newSelection.add(id);
        }
        lastSelectedIndex.current = index;
      }

      onSelectionChange(newSelection);
    },
    [selectedIds, onSelectionChange, displayEvents]
  );

  const selectAll = useCallback(() => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set(displayEvents.map((e) => e.id)));
  }, [displayEvents, onSelectionChange]);

  const selectNone = useCallback(() => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set());
    lastSelectedIndex.current = null;
  }, [onSelectionChange]);

  // Check if all visible items are selected
  const allSelected = displayEvents.length > 0 && displayEvents.every((e) => selectedIds.has(e.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  // Handle checkbox header click
  const handleHeaderCheckbox = () => {
    if (allSelected) {
      selectNone();
    } else {
      selectAll();
    }
  };

  // Get selected events for bulk actions
  const selectedEvents = useMemo(() => {
    return displayEvents.filter((e) => selectedIds.has(e.id));
  }, [displayEvents, selectedIds]);

  // Can only edit single activity selection
  const canEdit = selectedEvents.length === 1 && selectedEvents[0].type === 'activity';
  // Can delete non-screenshot events
  const canDelete = selectedEvents.length > 0 && selectedEvents.every((e) => e.type !== 'screenshot');
  // Can assign any selected events
  const canAssign = selectedEvents.length > 0;
  // Can merge 2+ items
  const canMerge = selectedEvents.length >= 2;

  // Handle edit click
  const handleEdit = () => {
    if (canEdit && onEventEdit) {
      onEventEdit(selectedEvents[0]);
    }
  };

  // Handle delete click
  const handleDelete = () => {
    if (canDelete && onEventDelete) {
      onEventDelete(new Set(selectedEvents.map((e) => e.id)));
      selectNone();
    }
  };

  // Handle project assignment
  const handleAssignProject = (projectId: number) => {
    if (canAssign && onAssignProject) {
      onAssignProject(new Set(selectedEvents.map((e) => e.id)), projectId);
      selectNone();
    }
  };

  // Handle merge
  const handleMerge = () => {
    if (canMerge && onMerge) {
      onMerge(new Set(selectedEvents.map((e) => e.id)));
    }
  };

  // Handle accept drafts
  const handleAcceptDrafts = () => {
    if (selectedEvents.length > 0 && onAcceptDrafts) {
      onAcceptDrafts(new Set(selectedEvents.map((e) => e.id)));
    }
  };

  // Format time for display
  const formatEventTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Sort icon component
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortMode === 'playhead') {
      // Show playhead icon on Time column when in playhead mode
      if (column === 'time') {
        return <Play className="h-2.5 w-2.5 fill-current text-blue-500" />;
      }
      return null;
    }
    if (columnSort.column !== column) return null;
    return columnSort.direction === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  // Reset last selected index when events change
  useEffect(() => {
    lastSelectedIndex.current = null;
  }, [rawEvents]);

  // Format playhead time for display
  const formatPlayheadTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (rawEvents.length === 0) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        {/* Collapsible header */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 cursor-pointer hover:bg-muted/50"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          <List className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Events</span>
          <span className="text-xs text-muted-foreground">(0)</span>
        </div>
        {!collapsed && (
          <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
            No events to display
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Collapsible header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 cursor-pointer hover:bg-muted/50"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        <List className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Events</span>
        <span className="text-xs text-muted-foreground">({sortedEvents.length})</span>
        {playheadTimestamp && (
          <span className="text-xs text-blue-400 flex items-center gap-1 ml-auto">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            {formatPlayheadTime(playheadTimestamp)}
          </span>
        )}
      </div>

      {/* Content - only show when not collapsed */}
      {collapsed ? null : (
      <>
      {/* Header with search, filters, and actions */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/30">
        {/* Search */}
        <div className="relative flex-1 max-w-[180px]">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-6 h-6 text-xs"
          />
        </div>

        {/* App filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-6 px-1.5 text-xs',
                selectedApps.size > 0 && 'text-primary'
              )}
            >
              <Filter className="h-3 w-3 mr-1" />
              Apps
              {selectedApps.size > 0 && (
                <span className="ml-1 px-1 py-0.5 bg-primary/20 rounded text-[10px]">
                  {selectedApps.size}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-auto">
            {selectedApps.size > 0 && (
              <>
                <DropdownMenuItem onClick={clearAppFilters} className="text-xs">
                  <X className="h-3 w-3 mr-1.5" />
                  Clear filters
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {uniqueApps.map((app) => (
              <DropdownMenuCheckboxItem
                key={app}
                checked={selectedApps.has(app)}
                onCheckedChange={() => toggleAppFilter(app)}
                className="text-xs"
              >
                {app}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Divider when selection active */}
        {selectedIds.size > 0 && (
          <div className="w-px h-4 bg-border" />
        )}

        {/* Action buttons - visible when items selected */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              onClick={handleEdit}
              disabled={!canEdit}
              title={canEdit ? 'Edit' : 'Select a single activity to edit'}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>

            {projects && (projects as Project[]).length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    disabled={!canAssign}
                  >
                    <FolderKanban className="h-3 w-3 mr-1" />
                    Assign
                    <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(projects as Project[]).map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => handleAssignProject(project.id)}
                      className="text-xs"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full mr-1.5 flex-shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      {project.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {onMerge && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs"
                onClick={handleMerge}
                disabled={!canMerge}
                title={canMerge ? 'Merge selected' : 'Select 2+ items to merge'}
              >
                <Merge className="h-3 w-3 mr-1" />
                Merge
              </Button>
            )}

            {onAcceptDrafts && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs"
                onClick={handleAcceptDrafts}
              >
                <Check className="h-3 w-3 mr-1" />
                Accept
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={!canDelete}
              title="Delete selected"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>

            <div className="w-px h-4 bg-border mx-0.5" />

            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1 text-xs"
              onClick={selectNone}
              title="Clear selection"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Item count */}
        <span className="text-[10px] text-muted-foreground ml-auto">
          {selectedIds.size > 0
            ? `${selectedIds.size} / ${sortedEvents.length}`
            : `${sortedEvents.length}`}
        </span>
      </div>

      {/* Column headers */}
      <div className="flex items-center border-b bg-muted/50 text-[10px] font-medium text-muted-foreground">
        {/* Checkbox header */}
        <div className="w-8 px-2 py-1 flex items-center justify-center">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={handleHeaderCheckbox}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-1 focus:ring-primary cursor-pointer accent-primary"
            title={allSelected ? 'Deselect all' : 'Select all'}
          />
        </div>
        <button
          onClick={() => {
            if (sortMode === 'playhead') {
              handleColumnSort('time');
            } else if (columnSort.column === 'time') {
              handlePlayheadMode();
            } else {
              handleColumnSort('time');
            }
          }}
          className="flex items-center gap-0.5 w-16 px-1 py-1 hover:bg-muted"
          title={sortMode === 'playhead' ? 'Click to sort by time' : 'Click to return to playhead order'}
        >
          Time <SortIcon column="time" />
        </button>
        <button
          onClick={() => handleColumnSort('duration')}
          className="flex items-center gap-0.5 w-14 px-1 py-1 hover:bg-muted"
        >
          Dur <SortIcon column="duration" />
        </button>
        <button
          onClick={() => handleColumnSort('app')}
          className="flex items-center gap-0.5 w-20 px-1 py-1 hover:bg-muted"
        >
          App <SortIcon column="app" />
        </button>
        <button
          onClick={() => handleColumnSort('title')}
          className="flex items-center gap-0.5 flex-1 px-1 py-1 hover:bg-muted"
        >
          Title <SortIcon column="title" />
        </button>
        <div className="w-24 px-1 py-1">Project</div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-auto text-xs">
        {displayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            {searchQuery || selectedApps.size > 0 ? 'No items match your filters' : 'No events to display'}
          </div>
        ) : (
          displayEvents.map((event, index) => {
            const Icon = EVENT_TYPE_ICONS[event.type];
            const isSelected = selectedIds.has(event.id);
            const isAtPlayhead = sortMode === 'playhead' && index === 0;
            const canEditRow = event.type === 'activity';
            const canDeleteRow = event.type !== 'screenshot';
            const projectColor = event.metadata?.projectColor;
            const projectName = event.metadata?.projectName;

            return (
              <div
                key={event.id}
                onClick={(e) => {
                  toggleSelection(event.id, index, e.shiftKey);
                }}
                className={cn(
                  'flex items-center border-b cursor-pointer select-none group border-l-2',
                  isSelected
                    ? 'bg-primary/10 border-l-primary'
                    : 'border-l-transparent hover:bg-muted/50',
                  isAtPlayhead && !isSelected && 'bg-blue-500/5 border-l-blue-500/50'
                )}
              >
                {/* Checkbox */}
                <div className="w-8 px-2 py-1.5 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(event.id, index, false)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-1 focus:ring-primary cursor-pointer accent-primary"
                  />
                </div>

                {/* Time */}
                <div className="w-16 px-1 py-1.5 text-muted-foreground">
                  {formatEventTime(event.timestamp)}
                </div>

                {/* Duration */}
                <div className="w-14 px-1 py-1.5 text-muted-foreground">
                  {event.duration ? formatDuration(event.duration) : '-'}
                </div>

                {/* App with icon */}
                <div className="w-20 px-1 py-1.5 flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: event.color }}
                  >
                    <Icon className="h-2.5 w-2.5 text-white" />
                  </div>
                  <span className="truncate">{event.row}</span>
                </div>

                {/* Title */}
                <div className="flex-1 px-1 py-1.5 truncate">{event.label}</div>

                {/* Project badge */}
                <div className="w-24 px-1 py-1.5">
                  {projectName && projectColor && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                      style={{ backgroundColor: projectColor + '20', color: projectColor }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: projectColor }}
                      />
                      <span className="truncate max-w-[60px]">
                        {projectName}
                      </span>
                    </span>
                  )}
                </div>

                {/* Row action buttons - show on hover */}
                <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {canEditRow && onEventEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventEdit(event);
                      }}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {canDeleteRow && onEventDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventDelete(new Set([event.id]));
                      }}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        {hasMore && (
          <div className="px-2 py-1 text-[10px] text-muted-foreground text-center border-b">
            Showing first {maxItems} of {sortedEvents.length} events
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
