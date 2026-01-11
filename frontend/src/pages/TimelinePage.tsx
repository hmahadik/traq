import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { CalendarWidget } from '@/components/timeline';
import { useTimelineGridData, useCalendarHeatmap, useGenerateSummary } from '@/api/hooks';
import { TimelineGridView } from '@/components/timeline/TimelineGridView';
import { DailySummaryCard } from '@/components/timeline/DailySummaryCard';
import { BreakdownBar } from '@/components/timeline/BreakdownBar';
import { TopAppsSection } from '@/components/timeline/TopAppsSection';
import { TimelinePageSkeleton } from '@/components/timeline/TimelineGridSkeleton';
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  const dateStr = getDateString(selectedDate);
  const isToday = dateStr === getDateString(new Date());

  // Fetch grid data
  const { data: gridData, isLoading: gridLoading } = useTimelineGridData(dateStr);
  const { data: calendarData, isLoading: calendarLoading } = useCalendarHeatmap(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1
  );
  const generateSummary = useGenerateSummary();

  // Sessions without summaries
  const sessionsWithoutSummaries = useMemo(() => {
    if (!gridData?.sessionSummaries) return [];
    return gridData.sessionSummaries.filter(s => !s.summary);
  }, [gridData?.sessionSummaries]);

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
      toast.warning(`Generated ${successCount} summaries, ${errorCount} failed`);
    }
  }, [sessionsWithoutSummaries, isBatchGenerating, generateSummary]);

  // Navigation handlers
  const goToPreviousDay = useCallback(() => {
    setSelectedDate((d) => addDays(d, -1));
  }, []);

  const goToNextDay = useCallback(() => {
    if (!isToday) {
      setSelectedDate((d) => addDays(d, 1));
    }
  }, [isToday]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-5rem)] lg:h-[calc(100vh-3rem)]">
      {/* Header - Always visible */}
      <div className="xl:hidden">
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
              title={showCalendar ? 'Hide calendar' : 'Show calendar'}
            >
              <Calendar className="h-4 w-4" />
            </Button>
            {sessionsWithoutSummaries.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleBatchGenerateSummaries}
                disabled={isBatchGenerating}
                title={`Generate ${sessionsWithoutSummaries.length} missing summaries`}
              >
                {isBatchGenerating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                {sessionsWithoutSummaries.length}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {gridLoading ? (
        <TimelinePageSkeleton />
      ) : gridData ? (
        <>
          {/* Left Sidebar - Stats and Summary */}
          <div className="xl:w-80 xl:flex-shrink-0">
            <div className="xl:sticky xl:top-0 space-y-4">
              <DailySummaryCard stats={gridData.dayStats || null} />
              <BreakdownBar stats={gridData.dayStats || null} />
              <TopAppsSection topApps={gridData.topApps || []} />
            </div>
          </div>

          {/* Main Content - Timeline Grid */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Header - Desktop */}
            <div className="hidden xl:flex items-center justify-between mb-6">
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
                {/* Quick Date Jump Buttons */}
                <div className="flex items-center gap-1 ml-2">
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
                  title={showCalendar ? 'Hide calendar' : 'Show calendar'}
                >
                  <Calendar className="h-4 w-4" />
                </Button>
                {sessionsWithoutSummaries.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleBatchGenerateSummaries}
                    disabled={isBatchGenerating}
                    title={`Generate ${sessionsWithoutSummaries.length} missing summaries`}
                  >
                    {isBatchGenerating ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    {sessionsWithoutSummaries.length}
                  </Button>
                )}
              </div>
            </div>

            {/* Grid View */}
            <TimelineGridView data={gridData} />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div>No data available</div>
        </div>
      )}

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
