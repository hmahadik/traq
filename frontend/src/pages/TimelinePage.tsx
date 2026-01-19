import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { CalendarWidget } from '@/components/timeline';
import {
  useTimelineGridData,
  useCalendarHeatmap,
  useGenerateSummary,
  useScreenshotsForDate,
  useDeleteActivities,
  useDeleteBrowserVisits,
  useDeleteGitCommits,
  useDeleteShellCommands,
  useDeleteFileEvents,
  useDeleteAFKEvents,
} from '@/api/hooks';
import { TimelineGridView } from '@/components/timeline/TimelineGridView';
import { EventDropsTimeline, EventDot } from '@/components/timeline/eventDrops';
import { ListModeToggle, DisplayMode } from '@/components/timeline/ListModeToggle';
import { DailySummaryCard } from '@/components/timeline/DailySummaryCard';
import { BreakdownBar } from '@/components/timeline/BreakdownBar';
import { TopAppsSection } from '@/components/timeline/TopAppsSection';
import { TimelinePageSkeleton } from '@/components/timeline/TimelineGridSkeleton';
import { FilterControls, TimelineFilters } from '@/components/timeline/FilterControls';
import { GlobalSearch } from '@/components/timeline/GlobalSearch';
import { ZoomControls, ZoomLevel, DEFAULT_ZOOM, ZOOM_LEVELS } from '@/components/timeline/ZoomControls';
import { SessionDetailDrawer } from '@/components/session/SessionDetailDrawer';
import { SelectionToolbar, SelectionBreakdown } from '@/components/timeline/SelectionToolbar';
import { ActivityEditDialog } from '@/components/timeline/ActivityEditDialog';
import { useActivitySelection } from '@/hooks/useActivitySelection';
import { EventKey, parseEventKey } from '@/utils/eventKeys';
import type { ActivityBlock } from '@/types/timeline';
import { toast } from 'sonner';

function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const FILTER_STORAGE_KEY = 'timeline-filters';
const ZOOM_STORAGE_KEY = 'timeline-zoom';
const DISPLAY_MODE_STORAGE_KEY = 'timeline-display-mode';

export function TimelinePage() {
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  // Session detail drawer state
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // Activity selection state
  const {
    selectedIds: selectedActivityIds,
    selectedCount,
    clearSelection,
    handleClick: handleActivityClick,
    lassoRect,
    startLasso,
    updateLasso,
    endLasso,
    lassoPreviewIds,
    setLassoPreviewIds,
  } = useActivitySelection();

  // Activity edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityBlock | null>(null);

  // Delete mutations for all event types
  const deleteActivities = useDeleteActivities();
  const deleteBrowserVisits = useDeleteBrowserVisits();
  const deleteGitCommits = useDeleteGitCommits();
  const deleteShellCommands = useDeleteShellCommands();
  const deleteFileEvents = useDeleteFileEvents();
  const deleteAFKEvents = useDeleteAFKEvents();

  // State for multi-type event selection (works in both grid and list views)
  const [selectedEventKeys, setSelectedEventKeys] = useState<Set<EventKey>>(new Set());

  // Lasso preview keys for all event types (grid view highlighting)
  const [lassoPreviewKeys, setLassoPreviewKeys] = useState<Set<EventKey>>(new Set());

  // Display mode state (grid vs drops)
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    try {
      const stored = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
      if (stored === 'grid' || stored === 'drops') return stored as DisplayMode;
    } catch (e) {
      console.error('Failed to load display mode from localStorage:', e);
    }
    return 'grid';
  });

  const [filters, setFilters] = useState<TimelineFilters>(() => {
    try {
      const stored = localStorage.getItem(FILTER_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to load filters from localStorage:', e);
    }
    return {
      showGit: true,
      showShell: true,
      showFiles: true,
      showBrowser: true,
      showScreenshots: true,
    };
  });

  const [zoom, setZoom] = useState<ZoomLevel>(() => {
    try {
      const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (ZOOM_LEVELS.includes(parsed as ZoomLevel)) return parsed as ZoomLevel;
      }
    } catch (e) {
      console.error('Failed to load zoom from localStorage:', e);
    }
    return DEFAULT_ZOOM;
  });

  // Persist display mode
  useEffect(() => {
    try {
      localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode);
    } catch (e) {
      console.error('Failed to save display mode to localStorage:', e);
    }
  }, [displayMode]);

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.error('Failed to save filters to localStorage:', e);
    }
  }, [filters]);

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, zoom.toString());
    } catch (e) {
      console.error('Failed to save zoom to localStorage:', e);
    }
  }, [zoom]);

  // Check URL params for sessionId to open drawer
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionIdParam = params.get('sessionId');
    if (sessionIdParam) {
      const id = parseInt(sessionIdParam, 10);
      if (!isNaN(id)) {
        setSelectedSessionId(id);
        setSessionDrawerOpen(true);
      }
    }
  }, [location.search]);

  const dateStr = getDateString(selectedDate);
  const isToday = dateStr === getDateString(new Date());

  // Fetch timeline grid data
  const { data: gridData, isLoading } = useTimelineGridData(dateStr);
  const { data: calendarData, isLoading: calendarLoading } = useCalendarHeatmap(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1
  );
  // Fetch screenshots for EventDrops view
  const { data: screenshotsData } = useScreenshotsForDate(dateStr, {
    enabled: displayMode === 'drops',
  });
  const generateSummary = useGenerateSummary();

  const sessionsWithoutSummaries = useMemo(() => {
    if (!gridData?.sessionSummaries) return [];
    return gridData.sessionSummaries.filter(s => !s.summary);
  }, [gridData?.sessionSummaries]);

  const handleBatchGenerateSummaries = useCallback(async () => {
    if (!sessionsWithoutSummaries.length || isBatchGenerating) return;

    setIsBatchGenerating(true);
    let successCount = 0;
    let errorCount = 0;

    toast.info(`Generating ${sessionsWithoutSummaries.length} summaries...`);

    for (const session of sessionsWithoutSummaries) {
      try {
        await generateSummary.mutateAsync(session.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to generate summary for session ${session.id}:`, error);
        errorCount++;
      }
    }

    setIsBatchGenerating(false);
    if (errorCount === 0) {
      toast.success(`Successfully generated ${successCount} summaries`);
    } else {
      toast.warning(`Generated ${successCount} summaries, ${errorCount} failed`);
    }
  }, [sessionsWithoutSummaries, isBatchGenerating, generateSummary]);

  // Handle session click - open drawer
  const handleSessionClick = useCallback((sessionId: number) => {
    setSelectedSessionId(sessionId);
    setSessionDrawerOpen(true);
  }, []);

  // Handle EventDrops event delete
  const handleEventDropDelete = useCallback((event: EventDot) => {
    const id = event.originalId;
    const label = event.label.length > 30 ? event.label.slice(0, 30) + '...' : event.label;

    const onSuccess = () => {
      toast.success(`Deleted: ${label}`);
    };
    const onError = () => {
      toast.error(`Failed to delete: ${label}`);
    };

    switch (event.type) {
      case 'activity':
        deleteActivities.mutate([id], { onSuccess, onError });
        break;
      case 'browser':
        deleteBrowserVisits.mutate([id], { onSuccess, onError });
        break;
      case 'git':
        deleteGitCommits.mutate([id], { onSuccess, onError });
        break;
      case 'shell':
        deleteShellCommands.mutate([id], { onSuccess, onError });
        break;
      case 'file':
        deleteFileEvents.mutate([id], { onSuccess, onError });
        break;
      case 'afk':
        deleteAFKEvents.mutate([id], { onSuccess, onError });
        break;
      case 'screenshot':
        // Screenshots don't have a delete mutation yet
        toast.info('Screenshot deletion not yet implemented');
        break;
    }
  }, [deleteActivities, deleteBrowserVisits, deleteGitCommits, deleteShellCommands, deleteFileEvents, deleteAFKEvents]);

  // Handle EventDrops event edit
  const handleEventDropEdit = useCallback((event: EventDot) => {
    // Only activities can be edited for now
    if (event.type === 'activity' && gridData) {
      // Find the activity in the grid data
      for (const hourActivities of Object.values(gridData.hourlyGrid)) {
        for (const appActivities of Object.values(hourActivities)) {
          const activity = appActivities.find((a) => a.id === event.originalId);
          if (activity) {
            setEditingActivity(activity);
            setEditDialogOpen(true);
            return;
          }
        }
      }
      toast.error('Could not find activity to edit');
    } else {
      toast.info(`Editing ${event.type} events not yet supported`);
    }
  }, [gridData]);

  // Handle EventDrops view screenshot
  const handleEventDropViewScreenshot = useCallback((event: EventDot) => {
    if (event.type === 'screenshot') {
      // Navigate to screenshots page with this screenshot selected
      // For now, just show a toast - full implementation would open a viewer
      const meta = event.metadata as { filePath?: string };
      if (meta.filePath) {
        // Could open a modal here, for now toast with path
        toast.info(`Screenshot: ${meta.filePath.split('/').pop()}`);
      }
    } else if (event.type === 'activity') {
      // For activities, would need to find associated screenshot by timestamp
      toast.info('Screenshot viewing for activities coming soon');
    }
  }, []);

  // Handle activity selection (for grid view - simple click)
  const handleActivitySelect = useCallback(
    (id: number, event: React.MouseEvent) => {
      handleActivityClick(id, event);
    },
    [handleActivityClick]
  );

  // Handle double-click to edit activity
  const handleActivityDoubleClick = useCallback((activity: ActivityBlock) => {
    setEditingActivity(activity);
    setEditDialogOpen(true);
  }, []);

  // Handle lasso end with EventKeys (selects all event types in grid view)
  const handleLassoEndWithKeys = useCallback((keys: string[]) => {
    setSelectedEventKeys(new Set(keys));
    setLassoPreviewKeys(new Set());
  }, []);

  // Handle lasso preview with EventKeys (highlights all event types during drag)
  const handleLassoPreviewKeys = useCallback((keys: string[]) => {
    setLassoPreviewKeys(new Set(keys));
  }, []);

  // Compute breakdown from selectedEventKeys
  const selectionBreakdown = useMemo((): SelectionBreakdown => {
    const breakdown: SelectionBreakdown = {};
    selectedEventKeys.forEach((key) => {
      const { type } = parseEventKey(key);
      switch (type) {
        case 'activity':
          breakdown.activity = (breakdown.activity || 0) + 1;
          break;
        case 'browser':
          breakdown.browser = (breakdown.browser || 0) + 1;
          break;
        case 'git':
          breakdown.git = (breakdown.git || 0) + 1;
          break;
        case 'shell':
          breakdown.shell = (breakdown.shell || 0) + 1;
          break;
        case 'file':
          breakdown.file = (breakdown.file || 0) + 1;
          break;
        case 'afk':
          breakdown.afk = (breakdown.afk || 0) + 1;
          break;
      }
    });
    return breakdown;
  }, [selectedEventKeys]);

  // Clear all selections (both activity-specific and event-generic)
  const clearAllSelections = useCallback(() => {
    clearSelection();
    setSelectedEventKeys(new Set());
  }, [clearSelection]);

  // Handle bulk delete - supports all event types
  const handleDeleteSelected = useCallback(async () => {
    // Group selected items by type
    const byType: Record<string, number[]> = {};
    selectedEventKeys.forEach((key) => {
      const { type, id } = parseEventKey(key);
      if (!byType[type]) byType[type] = [];
      byType[type].push(id);
    });

    // Also include activity IDs from grid selection (for backwards compatibility)
    if (selectedActivityIds.size > 0 && !byType['activity']) {
      byType['activity'] = Array.from(selectedActivityIds);
    } else if (selectedActivityIds.size > 0 && byType['activity']) {
      // Merge, avoiding duplicates
      const activitySet = new Set([...byType['activity'], ...Array.from(selectedActivityIds)]);
      byType['activity'] = Array.from(activitySet);
    }

    const totalCount = Object.values(byType).reduce((sum, ids) => sum + ids.length, 0);
    if (totalCount === 0) return;

    try {
      const promises: Promise<void>[] = [];

      if (byType['activity']?.length) {
        promises.push(deleteActivities.mutateAsync(byType['activity']));
      }
      if (byType['browser']?.length) {
        promises.push(deleteBrowserVisits.mutateAsync(byType['browser']));
      }
      if (byType['git']?.length) {
        promises.push(deleteGitCommits.mutateAsync(byType['git']));
      }
      if (byType['shell']?.length) {
        promises.push(deleteShellCommands.mutateAsync(byType['shell']));
      }
      if (byType['file']?.length) {
        promises.push(deleteFileEvents.mutateAsync(byType['file']));
      }
      if (byType['afk']?.length) {
        promises.push(deleteAFKEvents.mutateAsync(byType['afk']));
      }

      await Promise.all(promises);
      clearAllSelections();
      toast.success(`Deleted ${totalCount} ${totalCount === 1 ? 'item' : 'items'}`);
    } catch (error) {
      console.error('Failed to delete items:', error);
      toast.error('Failed to delete selected items');
    }
  }, [
    selectedEventKeys,
    selectedActivityIds,
    deleteActivities,
    deleteBrowserVisits,
    deleteGitCommits,
    deleteShellCommands,
    deleteFileEvents,
    deleteAFKEvents,
    clearAllSelections,
  ]);

  // Handle edit from selection toolbar (for single selection)
  const handleEditSelected = useCallback(() => {
    if (selectedActivityIds.size !== 1 || !gridData) return;

    const selectedId = Array.from(selectedActivityIds)[0];
    // Find the activity in the grid data
    for (const hourActivities of Object.values(gridData.hourlyGrid)) {
      for (const appActivities of Object.values(hourActivities)) {
        const activity = appActivities.find((a) => a.id === selectedId);
        if (activity) {
          setEditingActivity(activity);
          setEditDialogOpen(true);
          return;
        }
      }
    }
  }, [selectedActivityIds, gridData]);

  // Clear selection when date changes
  useEffect(() => {
    clearAllSelections();
  }, [dateStr, clearAllSelections]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    setSelectedDate((d) => addDays(d, -1));
  }, []);

  const goToNext = useCallback(() => {
    if (!isToday) setSelectedDate((d) => addDays(d, 1));
  }, [isToday]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleSearchNavigateToDate = useCallback((dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    setSelectedDate(date);
    setShowCalendar(false);
  }, []);

  // Format header date
  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'arrowleft':
          goToPrevious();
          break;
        case 'arrowright':
          if (!isToday) goToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, isToday]);

  // Render timeline content
  const renderContent = () => {
    if (isLoading) {
      return <TimelinePageSkeleton />;
    }

    if (!gridData) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No data available
        </div>
      );
    }

    return (
      <>
        {/* Left Sidebar */}
        <div className="xl:w-72 xl:flex-shrink-0">
          <div className="xl:sticky xl:top-0 space-y-3">
            <DailySummaryCard stats={gridData.dayStats || null} />
            <BreakdownBar stats={gridData.dayStats || null} />
            <TopAppsSection topApps={gridData.topApps || []} />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden xl:flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListModeToggle displayMode={displayMode} onDisplayModeChange={setDisplayMode} />
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{formattedDate}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext} disabled={isToday}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant={isToday ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleDateSelect(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant={dateStr === getDateString(addDays(new Date(), -1)) ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleDateSelect(addDays(new Date(), -1))}
                >
                  Yesterday
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FilterControls filters={filters} onFiltersChange={setFilters} />
              {displayMode === 'grid' && <ZoomControls zoom={zoom} onZoomChange={setZoom} />}
              <GlobalSearch onNavigateToDate={handleSearchNavigateToDate} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowCalendar(!showCalendar)}
              >
                <Calendar className="h-4 w-4" />
              </Button>
              {sessionsWithoutSummaries.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleBatchGenerateSummaries}
                  disabled={isBatchGenerating}
                  title={`Generate ${sessionsWithoutSummaries.length} summaries`}
                >
                  {isBatchGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {displayMode === 'grid' ? (
            <TimelineGridView
              data={gridData}
              filters={filters}
              hourHeight={zoom}
              onSessionClick={handleSessionClick}
              selectedActivityIds={selectedActivityIds}
              onActivitySelect={handleActivitySelect}
              onActivityDoubleClick={handleActivityDoubleClick}
              lassoRect={lassoRect}
              onLassoStart={startLasso}
              onLassoMove={updateLasso}
              onLassoEnd={endLasso}
              selectedEventKeys={selectedEventKeys}
              onLassoEndWithKeys={handleLassoEndWithKeys}
              lassoPreviewIds={lassoPreviewIds}
              onLassoPreview={setLassoPreviewIds}
              lassoPreviewKeys={lassoPreviewKeys}
              onLassoPreviewKeys={handleLassoPreviewKeys}
            />
          ) : (
            <EventDropsTimeline
              data={gridData}
              filters={filters}
              screenshots={screenshotsData}
              onEventDelete={handleEventDropDelete}
              onEventEdit={handleEventDropEdit}
              onViewScreenshot={handleEventDropViewScreenshot}
            />
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-4 h-[calc(100vh-5rem)] lg:h-[calc(100vh-3rem)]">
      {/* Mobile Header */}
      <div className="xl:hidden flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ListModeToggle displayMode={displayMode} onDisplayModeChange={setDisplayMode} />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">{formattedDate}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext} disabled={isToday}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <FilterControls filters={filters} onFiltersChange={setFilters} />
          {displayMode === 'grid' && <ZoomControls zoom={zoom} onZoomChange={setZoom} />}
          <GlobalSearch onNavigateToDate={handleSearchNavigateToDate} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowCalendar(!showCalendar)}
          >
            <Calendar className="h-4 w-4" />
          </Button>
          {sessionsWithoutSummaries.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleBatchGenerateSummaries}
              disabled={isBatchGenerating}
              title={`Generate ${sessionsWithoutSummaries.length} summaries`}
            >
              {isBatchGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {renderContent()}

      {/* Session Detail Drawer */}
      <SessionDetailDrawer
        open={sessionDrawerOpen}
        onOpenChange={setSessionDrawerOpen}
        sessionId={selectedSessionId}
      />

      {/* Activity Selection Toolbar */}
      <SelectionToolbar
        selectedCount={selectedEventKeys.size > 0 ? selectedEventKeys.size : selectedCount}
        onDelete={handleDeleteSelected}
        onEdit={handleEditSelected}
        onClear={clearAllSelections}
        isDeleting={
          deleteActivities.isPending ||
          deleteBrowserVisits.isPending ||
          deleteGitCommits.isPending ||
          deleteShellCommands.isPending ||
          deleteFileEvents.isPending ||
          deleteAFKEvents.isPending
        }
        breakdown={selectedEventKeys.size > 0 ? selectionBreakdown : (selectedCount > 0 ? { activity: selectedCount } : undefined)}
      />

      {/* Activity Edit Dialog */}
      <ActivityEditDialog
        activity={editingActivity}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingActivity(null);
        }}
      />

      {showCalendar && (
        <div className="w-72 flex-shrink-0">
          <div className="sticky top-0">
            <CalendarWidget
              data={calendarData}
              isLoading={calendarLoading}
              selectedDate={selectedDate}
              onSelectDate={handleDateSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
}
