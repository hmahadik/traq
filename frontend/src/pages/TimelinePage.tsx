import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { CalendarWidget, ViewModeSelector, ViewMode } from '@/components/timeline';
import { useTimelineGridData, useCalendarHeatmap, useGenerateSummary, useWeekTimelineData } from '@/api/hooks';
import { TimelineGridView } from '@/components/timeline/TimelineGridView';
import { TimelineListView } from '@/components/timeline/TimelineListView';
import { SplitTimelineView } from '@/components/timeline/SplitTimelineView';
import { ListModeToggle, DisplayMode } from '@/components/timeline/ListModeToggle';
import { TimelineWeekView, TimelineWeekViewSkeleton } from '@/components/timeline/TimelineWeekView';
import { DailySummaryCard } from '@/components/timeline/DailySummaryCard';
import { WeekSummaryCard } from '@/components/timeline/WeekSummaryCard';
import { BreakdownBar } from '@/components/timeline/BreakdownBar';
import { TopAppsSection } from '@/components/timeline/TopAppsSection';
import { TimelinePageSkeleton } from '@/components/timeline/TimelineGridSkeleton';
import { FilterControls, TimelineFilters } from '@/components/timeline/FilterControls';
import { GlobalSearch } from '@/components/timeline/GlobalSearch';
import { ZoomControls, ZoomLevel, DEFAULT_ZOOM, ZOOM_LEVELS } from '@/components/timeline/ZoomControls';
import { SessionDetailDrawer } from '@/components/session/SessionDetailDrawer';
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

// Get the Monday of the week for a given date
function getWeekStartDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday is day 1, Sunday is day 0
  d.setDate(d.getDate() + diff);
  return getDateString(d);
}

// Format date range for week view header
function formatWeekRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
}

const FILTER_STORAGE_KEY = 'timeline-filters';
const ZOOM_STORAGE_KEY = 'timeline-zoom';
const VIEW_MODE_STORAGE_KEY = 'timeline-view-mode';
const DISPLAY_MODE_STORAGE_KEY = 'timeline-display-mode';

export function TimelinePage() {
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  // Session detail drawer state
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (stored === 'day' || stored === 'week') return stored;
    } catch (e) {
      console.error('Failed to load view mode from localStorage:', e);
    }
    return 'day';
  });

  // Display mode state for day view (grid vs list vs split)
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    try {
      const stored = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
      if (stored === 'grid' || stored === 'list' || stored === 'split') return stored as DisplayMode;
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

  // Persist view mode
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch (e) {
      console.error('Failed to save view mode to localStorage:', e);
    }
  }, [viewMode]);

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
  const weekStartDate = useMemo(() => getWeekStartDate(selectedDate), [selectedDate]);

  // Check if we're in the current week
  const isCurrentWeek = useMemo(() => {
    const todayWeekStart = getWeekStartDate(new Date());
    return weekStartDate === todayWeekStart;
  }, [weekStartDate]);

  // Fetch data based on view mode
  const { data: gridData, isLoading: gridLoading } = useTimelineGridData(dateStr);
  const { data: weekData, isLoading: weekLoading } = useWeekTimelineData(
    weekStartDate,
    viewMode === 'week'
  );
  const { data: calendarData, isLoading: calendarLoading } = useCalendarHeatmap(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1
  );
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

  // Navigation handlers - adjust based on view mode
  const goToPrevious = useCallback(() => {
    if (viewMode === 'day') {
      setSelectedDate((d) => addDays(d, -1));
    } else {
      setSelectedDate((d) => addDays(d, -7));
    }
  }, [viewMode]);

  const goToNext = useCallback(() => {
    if (viewMode === 'day') {
      if (!isToday) setSelectedDate((d) => addDays(d, 1));
    } else {
      // In week mode, check if next week is in the future
      if (!isCurrentWeek) setSelectedDate((d) => addDays(d, 7));
    }
  }, [viewMode, isToday, isCurrentWeek]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // Handle clicking a day in week view - switch to day view for that date
  const handleWeekDayClick = useCallback((date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    setSelectedDate(new Date(year, month - 1, day));
    setViewMode('day');
  }, []);

  const handleSearchNavigateToDate = useCallback((dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    setSelectedDate(date);
    setShowCalendar(false);
  }, []);

  // Format header based on view mode
  const formattedDate = viewMode === 'day'
    ? selectedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : weekData
      ? formatWeekRange(weekData.startDate, weekData.endDate)
      : 'Loading...';

  // Determine loading state based on view mode
  const isLoading = viewMode === 'day' ? gridLoading : weekLoading;

  // Determine if next button should be disabled
  const isNextDisabled = viewMode === 'day' ? isToday : isCurrentWeek;

  // Keyboard shortcuts for view switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'd':
          setViewMode('day');
          break;
        case 'w':
          setViewMode('week');
          break;
        case 'arrowleft':
          goToPrevious();
          break;
        case 'arrowright':
          if (!isNextDisabled) goToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, isNextDisabled]);

  // Render content based on view mode
  const renderContent = () => {
    if (isLoading) {
      return viewMode === 'day' ? <TimelinePageSkeleton /> : <TimelineWeekViewSkeleton />;
    }

    if (viewMode === 'day') {
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
                <ViewModeSelector viewMode={viewMode} onViewModeChange={setViewMode} />
                <div className="w-px h-6 bg-border mx-1" />
                <ListModeToggle displayMode={displayMode} onDisplayModeChange={setDisplayMode} />
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">{formattedDate}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext} disabled={isNextDisabled}>
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
                {(displayMode === 'grid' || displayMode === 'split') && <ZoomControls zoom={zoom} onZoomChange={setZoom} />}
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
              <TimelineGridView data={gridData} filters={filters} hourHeight={zoom} onSessionClick={handleSessionClick} />
            ) : displayMode === 'list' ? (
              <TimelineListView data={gridData} filters={filters} onSessionClick={handleSessionClick} />
            ) : (
              /* Split view - Grid and List side by side with synchronized scrolling */
              <SplitTimelineView data={gridData} filters={filters} hourHeight={zoom} onSessionClick={handleSessionClick} />
            )}
          </div>
        </>
      );
    }

    // Week view
    return (
      <>
        {/* Left Sidebar for Week View */}
        <div className="xl:w-72 xl:flex-shrink-0">
          <div className="xl:sticky xl:top-0 space-y-3">
            <WeekSummaryCard stats={weekData?.weekStats || null} />
          </div>
        </div>

        {/* Main Content - Week Grid */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden xl:flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ViewModeSelector viewMode={viewMode} onViewModeChange={setViewMode} />
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{formattedDate}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext} disabled={isNextDisabled}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant={isCurrentWeek ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleDateSelect(new Date())}
                >
                  This Week
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GlobalSearch onNavigateToDate={handleSearchNavigateToDate} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowCalendar(!showCalendar)}
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TimelineWeekView data={weekData || null} onDayClick={handleWeekDayClick} />
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-4 h-[calc(100vh-5rem)] lg:h-[calc(100vh-3rem)]">
      {/* Mobile Header */}
      <div className="xl:hidden flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ViewModeSelector viewMode={viewMode} onViewModeChange={setViewMode} />
          {viewMode === 'day' && <ListModeToggle displayMode={displayMode} onDisplayModeChange={setDisplayMode} />}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">{formattedDate}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext} disabled={isNextDisabled}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'day' && (
            <>
              <FilterControls filters={filters} onFiltersChange={setFilters} />
              {(displayMode === 'grid' || displayMode === 'split') && <ZoomControls zoom={zoom} onZoomChange={setZoom} />}
            </>
          )}
          <GlobalSearch onNavigateToDate={handleSearchNavigateToDate} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowCalendar(!showCalendar)}
          >
            <Calendar className="h-4 w-4" />
          </Button>
          {viewMode === 'day' && sessionsWithoutSummaries.length > 0 && (
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
