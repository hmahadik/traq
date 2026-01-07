import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SessionCardWithThumbnails, SessionCardSkeleton, CalendarWidget, TimelineStats } from '@/components/timeline';
import {
  useSessionsForDate,
  useCalendarHeatmap,
  useGenerateSummary,
} from '@/api/hooks';
import { useListNav } from '@/hooks/useListNav';
import { formatDate } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Calendar, List } from 'lucide-react';

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function TimelinePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [showCalendar, setShowCalendar] = useState(true);

  const dateStr = getDateString(selectedDate);
  const isToday = dateStr === getDateString(new Date());

  const { data: sessions, isLoading: sessionsLoading } = useSessionsForDate(dateStr);
  const { data: calendarData, isLoading: calendarLoading } = useCalendarHeatmap(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1
  );
  const generateSummary = useGenerateSummary();

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

  // List navigation for sessions
  const sessionIds = useMemo(() => sessions?.map((s) => s.id) || [], [sessions]);
  const { selectedIndex, setSelectedIndex } = useListNav({
    itemCount: sessionIds.length,
    onSelect: (index: number) => {
      if (sessions?.[index]) {
        setSelectedSessionId(sessions[index].id);
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
  }, []);

  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Stats Sidebar */}
      <div className="hidden xl:block w-72 flex-shrink-0">
        <div className="sticky top-0">
          <TimelineStats
            sessions={sessions}
            isLoading={sessionsLoading}
            date={selectedDate}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
            <p className="text-muted-foreground">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-2">
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
            {!isToday && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDateSelect(new Date())}
              >
                Today
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowCalendar(!showCalendar)}
              className="lg:hidden"
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="space-y-4">
            {sessionsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <SessionCardSkeleton key={i} />
              ))
            ) : !sessions || sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <List className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No sessions recorded</p>
                <p className="text-sm mt-1">
                  {isToday
                    ? 'Sessions will appear here as you work'
                    : `No activity recorded on ${formatDate(selectedDate.getTime() / 1000)}`}
                </p>
              </div>
            ) : (
              sessions.map((session, index) => (
                <SessionCardWithThumbnails
                  key={session.id}
                  session={session}
                  isSelected={selectedSessionId === session.id || selectedIndex === index}
                  onSelect={() => handleSessionSelect(session.id)}
                  onGenerateSummary={() => handleGenerateSummary(session.id)}
                  isGeneratingSummary={
                    generateSummary.isPending && generateSummary.variables === session.id
                  }
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Keyboard Navigation Hint */}
        {sessions && sessions.length > 0 && (
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground text-center">
            Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑</kbd>{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↓</kbd> or{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">j</kbd>{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">k</kbd> to navigate,{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> to expand
          </div>
        )}
      </div>

      {/* Calendar Sidebar */}
      <div
        className={`${
          showCalendar ? 'block' : 'hidden'
        } lg:block w-72 flex-shrink-0`}
      >
        <div className="sticky top-0">
          <CalendarWidget
            data={calendarData}
            isLoading={calendarLoading}
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
          />
        </div>
      </div>
    </div>
  );
}
