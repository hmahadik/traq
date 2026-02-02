import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, Sparkles, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SplitPanel } from '@/components/common/SplitPanel';
import { EventList } from '@/components/timeline/EventList';
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
  useDeleteScreenshot,
  useDeleteSession,
  useBulkAssignProject,
  useBulkAcceptDraftsBySession,
} from '@/api/hooks';
import { useMultiDayTimeline } from '@/hooks/useMultiDayTimeline';
import { Timeline, EventDot } from '@/components/timeline';
import { DailySummaryCard } from '@/components/timeline/DailySummaryCard';
import { BreakdownBar } from '@/components/timeline/BreakdownBar';
import { TopAppsSection } from '@/components/timeline/TopAppsSection';
import { FilterControls, TimelineFilters } from '@/components/timeline/FilterControls';
import { GlobalSearch } from '@/components/timeline/GlobalSearch';
import { SessionDetailDrawer } from '@/components/session/SessionDetailDrawer';
import { ActivityEditDialog } from '@/components/timeline/ActivityEditDialog';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  // App filter from URL (e.g., ?app=Chrome)
  const appFilter = searchParams.get('app');

  // Handle clearing the app filter (called when EventList clears filter or user clicks X)
  const handleClearAppFilter = useCallback((_app?: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('app');
    navigate({ search: newParams.toString() }, { replace: true });
  }, [searchParams, navigate]);

  // Calendar heatmap month (tracks which month the calendar widget is showing)
  const [calendarYear, setCalendarYear] = useState(selectedDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(selectedDate.getMonth() + 1);

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
  const deleteScreenshot = useDeleteScreenshot();
  const deleteSession = useDeleteSession();
  const bulkAssignProject = useBulkAssignProject();
  const bulkAcceptDrafts = useBulkAcceptDraftsBySession();

  // State for multi-type event selection (works in both grid and list views)
  const [selectedEventKeys, setSelectedEventKeys] = useState<Set<EventKey>>(new Set());

  // Playhead timestamp from Timeline (for EventList ordering)
  const [playheadTimestamp, setPlayheadTimestamp] = useState<Date | null>(null);

  // EventList collapsed state (lifted here to control SplitPanel size)
  const [listCollapsed, setListCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('eventlist-collapsed');
      return stored === 'true';
    } catch {
      return false;
    }
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

  // Multi-day timeline data
  const {
    loadedDays,
    timeRange,
    allScreenshots,
    centerDate,
    isLoadingAny,
    loadingDays,
    updateCenterFromPlayhead,
    // Navigation functions
    targetPlayheadDate,
    goToDate,
    goToToday,
    clearTargetPlayhead,
  } = useMultiDayTimeline(dateStr);

  // Use centerDate (actual view position) for button highlighting, not selectedDate
  const todayStr = getDateString(new Date());
  const yesterdayStr = getDateString(addDays(new Date(), -1));
  const isViewingToday = centerDate === todayStr;
  const isViewingYesterday = centerDate === yesterdayStr;

  // Get the center day's grid data for sidebar stats
  const centerDayData = loadedDays.get(centerDate);
  const gridData = centerDayData?.gridData ?? null;
  const isLoading = isLoadingAny && !gridData;

  const { data: calendarData, isLoading: calendarLoading } = useCalendarHeatmap(
    calendarYear,
    calendarMonth
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
        deleteScreenshot.mutate(id, { onSuccess, onError });
        break;
      case 'session':
        deleteSession.mutate(id, { onSuccess, onError });
        break;
    }
  }, [deleteActivities, deleteBrowserVisits, deleteGitCommits, deleteShellCommands, deleteFileEvents, deleteAFKEvents, deleteScreenshot, deleteSession]);

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

  // Handle viewing session details from tooltip
  const handleViewSession = useCallback((event: EventDot) => {
    if (event.type === 'session' && event.originalId) {
      setSelectedSessionId(event.originalId);
      setSessionDrawerOpen(true);
    }
  }, []);

  // Handle selection change from drops visualization or list
  const handleSelectionChange = useCallback((keys: Set<EventKey>) => {
    setSelectedEventKeys(keys);
  }, []);

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    setSelectedEventKeys(new Set());
  }, []);

  // Handle delete for specific event IDs (used by EventList inline delete)
  const handleDeleteEvents = useCallback(async (ids: Set<EventKey>) => {
    // Group items by type
    const byType: Record<string, number[]> = {};
    ids.forEach((key) => {
      const { type, id } = parseEventKey(key);
      if (!byType[type]) byType[type] = [];
      byType[type].push(id);
    });

    const totalCount = Object.values(byType).reduce((sum, arr) => sum + arr.length, 0);
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
      if (byType['screenshot']?.length) {
        // Screenshots are deleted one at a time (API takes single ID)
        for (const id of byType['screenshot']) {
          promises.push(deleteScreenshot.mutateAsync(id));
        }
      }
      if (byType['session']?.length) {
        // Sessions are deleted one at a time (API takes single ID)
        for (const id of byType['session']) {
          promises.push(deleteSession.mutateAsync(id));
        }
      }

      await Promise.all(promises);
      clearAllSelections();
      toast.success(`Deleted ${totalCount} ${totalCount === 1 ? 'item' : 'items'}`);
    } catch (error) {
      console.error('Failed to delete items:', error);
      toast.error('Failed to delete selected items');
    }
  }, [
    deleteActivities,
    deleteBrowserVisits,
    deleteGitCommits,
    deleteShellCommands,
    deleteFileEvents,
    deleteAFKEvents,
    deleteScreenshot,
    deleteSession,
    clearAllSelections,
  ]);

  // Bulk action handlers
  // Handle project assignment from EventList
  const handleAssignToProject = useCallback((keys: Set<EventKey>, projectId: number) => {
    const assignments = Array.from(keys).map((key) => {
      const { type, id } = parseEventKey(key);
      return { eventType: type, eventId: id, projectId };
    });
    bulkAssignProject.mutate(assignments, {
      onSuccess: () => {
        clearAllSelections();
      },
    });
  }, [bulkAssignProject, clearAllSelections]);

  // Handle opening project dialog (for legacy flow)
  const handleAssignProject = useCallback((_keys: EventKey[]) => {
    setShowAssignDialog(true);
  }, []);

  const handleMerge = useCallback((_keys: Set<EventKey>) => {
    // TODO: Implement merge
    toast.info('Merge functionality coming soon');
  }, []);

  const handleAcceptDrafts = useCallback((keys: Set<EventKey>) => {
    const sessionIds: number[] = [];
    const activityIds: number[] = [];
    keys.forEach((key) => {
      const { type, id } = parseEventKey(key);
      if (type === 'session') {
        sessionIds.push(id);
      } else if (type === 'activity') {
        activityIds.push(id);
      }
    });
    if (sessionIds.length === 0 && activityIds.length === 0) return;
    bulkAcceptDrafts.mutate({ sessionIds, activityIds }, {
      onSuccess: () => clearAllSelections(),
    });
  }, [bulkAcceptDrafts, clearAllSelections]);

  // Wrapper for playhead change - captures timestamp for EventList ordering
  const handlePlayheadChange = useCallback((timestamp: Date, visibleRange?: { start: Date; end: Date }, zoomLevel?: number) => {
    setPlayheadTimestamp(timestamp);
    updateCenterFromPlayhead(timestamp, visibleRange, zoomLevel);
  }, [updateCenterFromPlayhead]);

  // Clear selection when date changes
  useEffect(() => {
    clearAllSelections();
  }, [dateStr, clearAllSelections]);

  // Navigation handlers
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setCalendarYear(date.getFullYear());
    setCalendarMonth(date.getMonth() + 1);
    goToDate(date);
  }, [goToDate]);

  const handleGoToToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(today);
    setCalendarYear(today.getFullYear());
    setCalendarMonth(today.getMonth() + 1);
    goToToday();
  }, [goToToday]);

  const handleGoToYesterday = useCallback(() => {
    const yesterday = addDays(new Date(), -1);
    setSelectedDate(yesterday);
    setCalendarYear(yesterday.getFullYear());
    setCalendarMonth(yesterday.getMonth() + 1);
    goToDate(yesterday);
  }, [goToDate]);

  const handlePrevDay = useCallback(() => {
    const [year, month, day] = centerDate.split('-').map(Number);
    const currentCenterDate = new Date(year, month - 1, day);
    const prevDate = addDays(currentCenterDate, -1);
    setSelectedDate(prevDate);
    goToDate(prevDate);
  }, [centerDate, goToDate]);

  const handleNextDay = useCallback(() => {
    const [year, month, day] = centerDate.split('-').map(Number);
    const currentCenterDate = new Date(year, month - 1, day);
    const nextDate = addDays(currentCenterDate, 1);
    // Don't allow navigating past today
    if (getDateString(nextDate) <= todayStr) {
      setSelectedDate(nextDate);
      goToDate(nextDate);
    }
  }, [centerDate, goToDate, todayStr]);

  const handleSearchNavigateToDate = useCallback((dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    setSelectedDate(date);
    setCalendarYear(year);
    setCalendarMonth(month);
    goToDate(date);
    setShowCalendar(false);
  }, [goToDate]);

  const handleCalendarMonthChange = useCallback((year: number, month: number) => {
    setCalendarYear(year);
    setCalendarMonth(month);
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

      // Arrow keys now reserved for timeline panning (handled by D3 zoom)
      // Day navigation removed - users pan the timeline instead
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Render timeline content
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
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
            <DailySummaryCard stats={gridData.dayStats || null} isToday={centerDate === todayStr} />
            <BreakdownBar stats={gridData.dayStats || null} />
            <TopAppsSection topApps={gridData.topApps || []} />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden xl:flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Prev/Next day navigation */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handlePrevDay}
                title="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[80px] text-center">{formattedDate}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNextDay}
                disabled={centerDate === todayStr}
                title="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Quick nav buttons */}
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant={isViewingToday ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleGoToToday}
                >
                  Today
                </Button>
                <Button
                  variant={isViewingYesterday ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleGoToYesterday}
                >
                  Yesterday
                </Button>
              </div>

              {/* Active app filter badge */}
              {appFilter && (
                <Badge variant="secondary" className="ml-2 gap-1 pr-1">
                  Filtered: {appFilter}
                  <button
                    onClick={handleClearAppFilter}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                    aria-label="Clear filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <FilterControls filters={filters} onFiltersChange={setFilters} />
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

          <SplitPanel
            direction="vertical"
            defaultSize={65}
            minSize={30}
            maxSize={85}
            storageKey="timeline-vertical-split-size"
            rightCollapsed={listCollapsed}
            collapsedSize={5}
            left={
              <Timeline
                data={gridData}
                filters={filters}
                screenshots={allScreenshots}
                entries={entriesData}
                hideEmbeddedList={true}
                selectedEventKeys={selectedEventKeys}
                onSelectionChange={handleSelectionChange}
                onEventDelete={handleEventDropDelete}
                onEventEdit={handleEventDropEdit}
                onViewScreenshot={handleEventDropViewScreenshot}
                onViewSession={handleViewSession}
                loadedDays={loadedDays}
                multiDayTimeRange={timeRange}
                onPlayheadChange={handlePlayheadChange}
                loadingDays={loadingDays}
                targetPlayheadDate={targetPlayheadDate}
                onTargetReached={clearTargetPlayhead}
              />
            }
            right={
              <EventList
                gridData={gridData}
                playheadTimestamp={playheadTimestamp}
                selectedIds={selectedEventKeys}
                onSelectionChange={handleSelectionChange}
                onEventEdit={handleEventDropEdit}
                onEventDelete={handleDeleteEvents}
                onAssignProject={handleAssignToProject}
                onMerge={handleMerge}
                onAcceptDrafts={handleAcceptDrafts}
                collapsed={listCollapsed}
                onCollapsedChange={setListCollapsed}
                appFilter={appFilter}
                onAppFilterChange={handleClearAppFilter}
              />
            }
          />
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-4 h-[calc(100vh-5rem)] lg:h-[calc(100vh-3rem)] select-none">
      {/* Mobile Header */}
      <div className="xl:hidden flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrevDay}
            title="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{formattedDate}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextDay}
            disabled={centerDate === todayStr}
            title="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant={isViewingToday ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={handleGoToToday}
          >
            Today
          </Button>
          {/* Active app filter badge - mobile */}
          {appFilter && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {appFilter}
              <button
                onClick={handleClearAppFilter}
                className="ml-1 rounded-full hover:bg-muted p-0.5"
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FilterControls filters={filters} onFiltersChange={setFilters} />
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

      {/* Activity Edit Dialog */}
      <ActivityEditDialog
        activity={editingActivity}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingActivity(null);
        }}
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
              onMonthChange={handleCalendarMonthChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
