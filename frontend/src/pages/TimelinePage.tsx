import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Sparkles, Loader2, PanelRight, PanelRightClose } from 'lucide-react';
import { SplitPanel } from '@/components/common/SplitPanel';
import { TimelineListView } from '@/components/timeline/TimelineListView';
import { CalendarWidget } from '@/components/timeline';
import {
  useCalendarHeatmap,
  useGenerateSummary,
  useEntriesForDate,
  useDeleteActivities,
  useDeleteBrowserVisits,
  useDeleteGitCommits,
  useDeleteShellCommands,
  useDeleteFileEvents,
  useDeleteAFKEvents,
} from '@/api/hooks';
import { useMultiDayTimeline } from '@/hooks/useMultiDayTimeline';
import { EventDropsTimeline, EventDot } from '@/components/timeline/eventDrops';
import { DailySummaryCard } from '@/components/timeline/DailySummaryCard';
import { BreakdownBar } from '@/components/timeline/BreakdownBar';
import { TopAppsSection } from '@/components/timeline/TopAppsSection';
import { TimelinePageSkeleton } from '@/components/timeline/TimelineGridSkeleton';
import { FilterControls, TimelineFilters } from '@/components/timeline/FilterControls';
import { GlobalSearch } from '@/components/timeline/GlobalSearch';
import { SessionDetailDrawer } from '@/components/session/SessionDetailDrawer';
import { ActivityEditDialog } from '@/components/timeline/ActivityEditDialog';
import { BulkActionsToolbar } from '@/components/timeline/BulkActionsToolbar';
import { ProjectAssignDialog } from '@/components/timeline/ProjectAssignDialog';
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

export function TimelinePage() {
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  // Session detail drawer state
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // Activity edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityBlock | null>(null);

  // Project assignment dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  // Delete mutations for all event types
  const deleteActivities = useDeleteActivities();
  const deleteBrowserVisits = useDeleteBrowserVisits();
  const deleteGitCommits = useDeleteGitCommits();
  const deleteShellCommands = useDeleteShellCommands();
  const deleteFileEvents = useDeleteFileEvents();
  const deleteAFKEvents = useDeleteAFKEvents();

  // State for multi-type event selection (works in both grid and list views)
  const [selectedEventKeys, setSelectedEventKeys] = useState<Set<EventKey>>(new Set());

  // Track where selection originated from - affects list filtering behavior
  // When selection comes from 'visualization' (drops), list filters to selected items
  // When selection comes from 'list', list does NOT filter (allows multi-select)
  const [selectionSource, setSelectionSource] = useState<'visualization' | 'list' | null>(null);

  // List panel state
  const [showListPanel, setShowListPanel] = useState(true);

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

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.error('Failed to save filters to localStorage:', e);
    }
  }, [filters]);

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

  // Multi-day timeline data
  const {
    loadedDays,
    timeRange,
    allScreenshots,
    centerDate,
    isLoadingAny,
    loadingDays,
    updateCenterFromPlayhead,
    setCenterDate,
  } = useMultiDayTimeline(dateStr);

  // Get the center day's grid data for sidebar stats
  const centerDayData = loadedDays.get(centerDate);
  const gridData = centerDayData?.gridData ?? null;
  const isLoading = isLoadingAny && !gridData;

  const { data: calendarData, isLoading: calendarLoading } = useCalendarHeatmap(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1
  );
  // Fetch entries (project-assigned activities) for EventDrops view
  const { data: entriesData } = useEntriesForDate(dateStr);
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

  // Handle selection change from drops visualization
  const handleDropsSelectionChange = useCallback((keys: Set<EventKey>) => {
    setSelectedEventKeys(keys);
    setSelectionSource(keys.size > 0 ? 'visualization' : null);
  }, []);

  // Handle selection change from list view
  const handleListSelectionChange = useCallback((keys: Set<EventKey>) => {
    setSelectedEventKeys(keys);
    setSelectionSource(keys.size > 0 ? 'list' : null);
  }, []);

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    setSelectedEventKeys(new Set());
  }, []);

  // Handle bulk delete - supports all event types
  const handleDeleteSelected = useCallback(async () => {
    // Group selected items by type
    const byType: Record<string, number[]> = {};
    selectedEventKeys.forEach((key) => {
      const { type, id } = parseEventKey(key);
      if (!byType[type]) byType[type] = [];
      byType[type].push(id);
    });

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
    deleteActivities,
    deleteBrowserVisits,
    deleteGitCommits,
    deleteShellCommands,
    deleteFileEvents,
    deleteAFKEvents,
    clearAllSelections,
  ]);

  // Bulk action handlers
  const handleAssignProject = useCallback((_keys: EventKey[]) => {
    setShowAssignDialog(true);
  }, []);

  const handleMerge = useCallback((_keys: EventKey[]) => {
    // TODO: Implement merge
    toast.info('Merge functionality coming soon');
  }, []);

  const handleAcceptDrafts = useCallback((_keys: EventKey[]) => {
    // TODO: Implement draft acceptance
    toast.info('Accept drafts functionality coming soon');
  }, []);

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

  // Format header date based on centerDate (follows playhead)
  const formattedDate = useMemo(() => {
    const [year, month, day] = centerDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, [centerDate]);

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
              <GlobalSearch onNavigateToDate={handleSearchNavigateToDate} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowListPanel(!showListPanel)}
                title={showListPanel ? "Hide list" : "Show list"}
              >
                {showListPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
              </Button>
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

          {showListPanel ? (
            <SplitPanel
              direction="vertical"
              defaultSize={65}
              minSize={30}
              maxSize={85}
              storageKey="timeline-vertical-split-size"
              left={
                <EventDropsTimeline
                  data={gridData}
                  filters={filters}
                  screenshots={allScreenshots}
                  entries={entriesData}
                  hideEmbeddedList={true}
                  selectedEventKeys={selectedEventKeys}
                  onSelectionChange={handleDropsSelectionChange}
                  onEventDelete={handleEventDropDelete}
                  onEventEdit={handleEventDropEdit}
                  onViewScreenshot={handleEventDropViewScreenshot}
                  loadedDays={loadedDays}
                  multiDayTimeRange={timeRange}
                  onPlayheadChange={updateCenterFromPlayhead}
                  loadingDays={loadingDays}
                />
              }
              right={
                <TimelineListView
                  data={gridData}
                  selectedIds={selectedEventKeys}
                  onSelectionChange={handleListSelectionChange}
                  selectionSource={selectionSource}
                />
              }
            />
          ) : (
            <EventDropsTimeline
              data={gridData}
              filters={filters}
              screenshots={allScreenshots}
              entries={entriesData}
              selectedEventKeys={selectedEventKeys}
              onSelectionChange={handleDropsSelectionChange}
              onEventDelete={handleEventDropDelete}
              onEventEdit={handleEventDropEdit}
              onViewScreenshot={handleEventDropViewScreenshot}
              loadedDays={loadedDays}
              multiDayTimeRange={timeRange}
              onPlayheadChange={updateCenterFromPlayhead}
              loadingDays={loadingDays}
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
          <GlobalSearch onNavigateToDate={handleSearchNavigateToDate} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowListPanel(!showListPanel)}
            title={showListPanel ? "Hide list" : "Show list"}
          >
            {showListPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
          </Button>
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

      {/* Activity Edit Dialog */}
      <ActivityEditDialog
        activity={editingActivity}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingActivity(null);
        }}
      />

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedKeys={selectedEventKeys}
        onClear={clearAllSelections}
        onAssignProject={handleAssignProject}
        onMerge={handleMerge}
        onDelete={handleDeleteSelected}
        onAcceptDrafts={handleAcceptDrafts}
      />

      {/* Project Assignment Dialog */}
      <ProjectAssignDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        activityKeys={Array.from(selectedEventKeys)}
        onComplete={clearAllSelections}
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
