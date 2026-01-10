import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SessionCardWithThumbnails, SessionCardSkeleton, CalendarWidget, TimelineStats, TimelineBands, TimelineTags, TimelineFilters, type TimePeriod, getTimePeriodRange } from '@/components/timeline';
import {
  useSessionsForDate,
  useCalendarHeatmap,
  useGenerateSummary,
  useScreenshotsForDate,
} from '@/api/hooks';
import { useListNav } from '@/hooks/useListNav';
import { formatDate } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Calendar, List, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

function getDateString(date: Date): string {
  // Use local date components to avoid timezone issues
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

export function TimelinePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [showCalendar, setShowCalendar] = useState(false); // Default to hidden for cleaner UI
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(null);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  const dateStr = getDateString(selectedDate);
  const isToday = dateStr === getDateString(new Date());

  const { data: sessions, isLoading: sessionsLoading } = useSessionsForDate(dateStr);
  const { data: calendarData, isLoading: calendarLoading } = useCalendarHeatmap(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1
  );
  const { data: screenshots } = useScreenshotsForDate(dateStr);
  const generateSummary = useGenerateSummary();

  // Get list of all apps from sessions for filter dropdown
  const availableApps = useMemo(() => {
    if (!sessions) return [];
    const appsSet = new Set<string>();
    sessions.forEach(session => {
      if (session.topApps) {
        session.topApps.forEach(app => appsSet.add(app));
      }
    });
    return Array.from(appsSet).sort();
  }, [sessions]);

  // Filter sessions by tag, time period, and app
  const filteredSessions = useMemo(() => {
    if (!sessions) return sessions;

    let filtered = sessions;

    // Filter by tag
    if (selectedTag) {
      filtered = filtered.filter(session =>
        session.tags?.includes(selectedTag)
      );
    }

    // Filter by time period
    if (timePeriod) {
      const periodRange = getTimePeriodRange(timePeriod);
      if (periodRange) {
        filtered = filtered.filter(session => {
          const sessionDate = new Date(session.startTime * 1000);
          const hour = sessionDate.getHours();
          return hour >= periodRange.startHour && hour < periodRange.endHour;
        });
      }
    }

    // Filter by app
    if (selectedApp) {
      filtered = filtered.filter(session =>
        session.topApps?.includes(selectedApp)
      );
    }

    return filtered;
  }, [sessions, selectedTag, timePeriod, selectedApp]);

  // Navigation handlers
  const goToPreviousDay = useCallback(() => {
    setSelectedDate((d) => addDays(d, -1));
    setSelectedSessionId(null);
  }, []);

  const goToNextDay = useCallback(() => {
    if (!isToday) {
      setSelectedDate((d) => addDays(d, 1));
      setSelectedSessionId(null);
    }
  }, [isToday]);

  // List navigation for filtered sessions
  const sessionIds = useMemo(() => filteredSessions?.map((s) => s.id) || [], [filteredSessions]);
  const { selectedIndex, setSelectedIndex } = useListNav({
    itemCount: sessionIds.length,
    onSelect: (index: number) => {
      if (filteredSessions?.[index]) {
        setSelectedSessionId(filteredSessions[index].id);
      }
    },
  });

  const handleSessionSelect = useCallback((sessionId: number) => {
    setSelectedSessionId(sessionId);
    const index = sessionIds.indexOf(sessionId);
    if (index >= 0) {
      setSelectedIndex(index);
    }
  }, [sessionIds, setSelectedIndex]);

  const handleGenerateSummary = useCallback((sessionId: number) => {
    generateSummary.mutate(sessionId);
  }, [generateSummary]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedSessionId(null);
    setSelectedTag(null); // Clear tag filter on date change
    setTimePeriod(null); // Clear time period filter on date change
    setSelectedApp(null); // Clear app filter on date change
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    // Toggle tag selection
    setSelectedTag(currentTag => currentTag === tag ? null : tag);
    setSelectedSessionId(null); // Clear session selection
  }, []);

  const handleTimePeriodChange = useCallback((period: TimePeriod) => {
    setTimePeriod(period);
    setSelectedSessionId(null); // Clear session selection
  }, []);

  const handleAppChange = useCallback((app: string | null) => {
    setSelectedApp(app);
    setSelectedSessionId(null); // Clear session selection
  }, []);

  // Get sessions without summaries
  const sessionsWithoutSummaries = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter(s => !s.summary);
  }, [sessions]);

  // Batch generate summaries
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
      toast.warning(
        `Generated ${successCount} summaries, ${errorCount} failed`,
        { description: 'Check the console for details' }
      );
    }
  }, [sessionsWithoutSummaries, isBatchGenerating, generateSummary]);

  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-5rem)] lg:h-[calc(100vh-3rem)]">
      {/* Stats Sidebar - On xl+ screens, show as left sidebar. On smaller screens, show as top section */}
      <div className="xl:w-72 xl:flex-shrink-0">
        <div className="xl:sticky xl:top-0 space-y-4">
          {/* On small screens, show stats and tags side by side (sm covers landscape mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
            <TimelineStats
              sessions={sessions}
              isLoading={sessionsLoading}
              date={selectedDate}
            />
            <TimelineTags
              sessions={sessions}
              isLoading={sessionsLoading}
              selectedTag={selectedTag}
              onTagClick={handleTagClick}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 xl:overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
            <p className="text-muted-foreground">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Batch Generate Summaries Button */}
            {sessionsWithoutSummaries.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleBatchGenerateSummaries}
                disabled={isBatchGenerating}
                className="hidden md:flex"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isBatchGenerating
                  ? 'Generating...'
                  : `Generate ${sessionsWithoutSummaries.length} ${sessionsWithoutSummaries.length > 1 ? 'Summaries' : 'Summary'}`}
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goToNextDay}
              disabled={isToday}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {/* Quick Date Jump Buttons */}
            <div className="hidden sm:flex items-center gap-1 ml-2">
              <Button
                variant={isToday ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleDateSelect(new Date())}
              >
                Today
              </Button>
              <Button
                variant={dateStr === getDateString(addDays(new Date(), -1)) ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleDateSelect(addDays(new Date(), -1))}
              >
                Yesterday
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Go to start of current week (Sunday)
                  const today = new Date();
                  const dayOfWeek = today.getDay();
                  const startOfWeek = addDays(today, -dayOfWeek);
                  handleDateSelect(startOfWeek);
                }}
              >
                This Week
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowCalendar(!showCalendar)}
              title={showCalendar ? "Hide calendar" : "Show calendar"}
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Timeline Bands Visualization */}
        {sessions && sessions.length > 0 && (
          <TimelineBands
            sessions={sessions}
            screenshots={screenshots || []}
            date={selectedDate}
            onSessionClick={handleSessionSelect}
            highlightedTimeRange={timePeriod ? getTimePeriodRange(timePeriod) : null}
          />
        )}

        {/* Time Period and App Filters */}
        {sessions && sessions.length > 0 && (
          <TimelineFilters
            timePeriod={timePeriod}
            selectedApp={selectedApp}
            availableApps={availableApps}
            onTimePeriodChange={handleTimePeriodChange}
            onAppChange={handleAppChange}
          />
        )}

        {/* Active Tag Filter Indicator */}
        {selectedTag && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Filtering by tag:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTag(null)}
              className="h-7"
            >
              {selectedTag}
              <span className="ml-2">×</span>
            </Button>
          </div>
        )}

        {/* Sessions List */}
        <ScrollArea className="flex-1 min-h-0 -mr-4 pr-4">
          <div className="space-y-4">
            {sessionsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <SessionCardSkeleton key={i} />
              ))
            ) : !filteredSessions || filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <List className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {timePeriod || selectedApp || selectedTag
                    ? 'No sessions match the current filters'
                    : 'No sessions recorded'}
                </p>
                <p className="text-sm mt-1">
                  {timePeriod || selectedApp || selectedTag ? (
                    <>Clear filters to see all sessions for this date</>
                  ) : isToday ? (
                    'Sessions will appear here as you work'
                  ) : (
                    `No activity recorded on ${formatDate(selectedDate.getTime() / 1000)}`
                  )}
                </p>
              </div>
            ) : (
              filteredSessions.map((session, index) => (
                <SessionCardWithThumbnails
                  key={session.id}
                  session={session}
                  isSelected={selectedIndex === index}
                  onGenerateSummary={() => handleGenerateSummary(session.id)}
                  isGeneratingSummary={
                    generateSummary.isPending && generateSummary.variables === session.id
                  }
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Calendar Sidebar */}
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
