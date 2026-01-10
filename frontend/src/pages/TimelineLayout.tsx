import { useState, useCallback, useMemo } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  SessionCardWithThumbnails,
  SessionCardSkeleton,
  TimelineStats,
  TimelineBands,
  TimelineTags,
  TimelineFilters,
  type TimePeriod,
  getTimePeriodRange,
} from '@/components/timeline';
import {
  useSessionsForDate,
  useGenerateSummary,
  useScreenshotsForDate,
} from '@/api/hooks';
import { formatDate, cn } from '@/lib/utils';
import {
  List,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  MousePointerClick,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDateContext } from '@/contexts';

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

export function TimelineLayout() {
  const navigate = useNavigate();
  const { id: selectedSessionId } = useParams<{ id: string }>();
  const { selectedDate } = useDateContext();

  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(null);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  const dateStr = getDateString(selectedDate);

  const { data: sessions, isLoading: sessionsLoading } = useSessionsForDate(dateStr);
  const { data: screenshots } = useScreenshotsForDate(dateStr);
  const generateSummary = useGenerateSummary();

  // Get list of all apps from sessions
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

  // Filter sessions
  const filteredSessions = useMemo(() => {
    if (!sessions) return sessions;

    let filtered = sessions;

    if (selectedTag) {
      filtered = filtered.filter(session => session.tags?.includes(selectedTag));
    }

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

    if (selectedApp) {
      filtered = filtered.filter(session => session.topApps?.includes(selectedApp));
    }

    return filtered;
  }, [sessions, selectedTag, timePeriod, selectedApp]);

  const handleSessionClick = useCallback((sessionId: number) => {
    navigate(`/timeline/session/${sessionId}`);
  }, [navigate]);

  const handleGenerateSummary = useCallback((sessionId: number) => {
    generateSummary.mutate(sessionId);
  }, [generateSummary]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(currentTag => currentTag === tag ? null : tag);
  }, []);

  const handleTimePeriodChange = useCallback((period: TimePeriod) => {
    setTimePeriod(period);
  }, []);

  const handleAppChange = useCallback((app: string | null) => {
    setSelectedApp(app);
  }, []);

  // Sessions without summaries
  const sessionsWithoutSummaries = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter(s => !s.summary);
  }, [sessions]);

  // Batch generate
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

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Sidebar Toggle for when hidden */}
      {!showSidebar && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-20 lg:left-24 lg:top-20 z-10"
          onClick={() => setShowSidebar(true)}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Session List Sidebar */}
      {showSidebar && (
        <div className="w-80 lg:w-96 flex-shrink-0 border-r flex flex-col bg-background">
          {/* Sidebar Header */}
          <div className="p-4 border-b space-y-3">
            {/* Title Row */}
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">Sessions</h1>
              <div className="flex items-center gap-1">
                {sessionsWithoutSummaries.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleBatchGenerateSummaries}
                    disabled={isBatchGenerating}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {isBatchGenerating ? '...' : sessionsWithoutSummaries.length}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowSidebar(false)}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Stats */}
            <TimelineStats
              sessions={sessions}
              isLoading={sessionsLoading}
              date={selectedDate}
              compact
            />

            {/* Timeline Bands */}
            {sessions && sessions.length > 0 && (
              <TimelineBands
                sessions={sessions}
                screenshots={screenshots || []}
                date={selectedDate}
                onSessionClick={handleSessionClick}
                highlightedTimeRange={timePeriod ? getTimePeriodRange(timePeriod) : null}
                compact
              />
            )}

            {/* Filters */}
            {sessions && sessions.length > 0 && (
              <TimelineFilters
                timePeriod={timePeriod}
                selectedApp={selectedApp}
                availableApps={availableApps}
                onTimePeriodChange={handleTimePeriodChange}
                onAppChange={handleAppChange}
                compact
              />
            )}

            {/* Tags */}
            <TimelineTags
              sessions={sessions}
              isLoading={sessionsLoading}
              selectedTag={selectedTag}
              onTagClick={handleTagClick}
              compact
            />
          </div>

          {/* Session List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {sessionsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <SessionCardSkeleton key={i} />
                ))
              ) : !filteredSessions || filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <List className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm font-medium">
                    {timePeriod || selectedApp || selectedTag
                      ? 'No matching sessions'
                      : 'No sessions recorded'}
                  </p>
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <SessionCardWithThumbnails
                    key={session.id}
                    session={session}
                    isSelected={selectedSessionId === String(session.id)}
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
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}

/**
 * Empty state shown when no session is selected
 */
export function TimelineEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="mb-4 p-4 rounded-full bg-muted">
        <MousePointerClick className="h-12 w-12 text-muted-foreground/50" />
      </div>
      <h2 className="text-xl font-semibold text-muted-foreground mb-2">
        Select a session
      </h2>
      <p className="text-sm text-muted-foreground/70 max-w-md">
        Click on a session from the list to view its details, screenshots, and activity log.
      </p>
    </div>
  );
}
