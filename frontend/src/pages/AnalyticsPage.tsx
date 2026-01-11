import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker, type DateRange } from '@/components/common';
import { useDateContext } from '@/contexts';
import {
  StatsGrid,
  ActivityChart,
  AppUsageChart,
  HeatmapChart,
  DataSourcesPanel,
  AppUsageTable,
  ProductivityScoreCard,
  FocusDistributionChart,
  ActivityTagsChart,
  TimeDistributionChart,
  TopWindowsList,
  WeeklyAnalytics,
  MonthlyAnalytics,
  YearlyAnalytics,
  CustomRangeAnalytics,
} from '@/components/analytics';
import {
  useDailyStats,
  useHourlyActivity,
  useHourlyActivityHeatmap,
  useAppUsage,
  useAppUsageRange,
  useDataSourceStats,
  useDataSourceStatsRange,
  useProductivityScore,
  useFocusDistribution,
  useActivityTags,
  useTopWindows,
  useWeeklyStats,
  useMonthlyStats,
  useYearlyStats,
  useCustomRangeStats,
  queryKeys,
} from '@/api/hooks';
import { Download, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/api/client';
import { toast } from 'sonner';

type ViewMode = 'day' | 'week' | 'month' | 'year' | 'custom';

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

function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day; // Sunday is 0
  return new Date(result.setDate(diff));
}

function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  return addDays(weekStart, 6); // Saturday
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getYearStart(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function getYearEnd(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

export function AnalyticsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedDate, setTimeframeType, setSelectedDate, setDateRange } = useDateContext();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [isRegenerating, setIsRegenerating] = useState(false);
  // Custom date range state
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6); // Default to last 7 days
    return { start, end };
  });

  // Update global timeframe type and dateRange when view mode changes
  useEffect(() => {
    setTimeframeType(viewMode as any);

    // Set the appropriate dateRange based on view mode
    switch (viewMode) {
      case 'day':
        setDateRange(null); // Single day, no range needed
        break;
      case 'week':
        setDateRange({
          start: getWeekStart(selectedDate),
          end: getWeekEnd(selectedDate),
        });
        break;
      case 'month':
        setDateRange({
          start: getMonthStart(selectedDate),
          end: getMonthEnd(selectedDate),
        });
        break;
      case 'year':
        setDateRange({
          start: getYearStart(selectedDate),
          end: getYearEnd(selectedDate),
        });
        break;
      case 'custom':
        setDateRange(customRange);
        break;
    }
  }, [viewMode, selectedDate, customRange, setTimeframeType, setDateRange]);

  const dateStr = getDateString(selectedDate);
  const weekStartStr = getDateString(getWeekStart(selectedDate));
  const isToday = dateStr === getDateString(new Date());

  // Calculate custom range timestamps
  const customStartTs = Math.floor(customRange.start.setHours(0, 0, 0, 0) / 1000);
  const customEndTs = Math.floor(customRange.end.setHours(23, 59, 59, 999) / 1000);

  // Day view data
  const { data: stats, isLoading: statsLoading } = useDailyStats(dateStr);
  const { data: hourlyActivity, isLoading: hourlyLoading } = useHourlyActivity(dateStr);
  const { data: heatmapData, isLoading: heatmapLoading } = useHourlyActivityHeatmap();
  const { data: appUsage, isLoading: appUsageLoading } = useAppUsage(dateStr);
  const { data: dataSourceStats, isLoading: dataSourcesLoading } = useDataSourceStats(dateStr);
  const { data: productivityScore, isLoading: productivityLoading } = useProductivityScore(dateStr);
  const { data: focusDistribution, isLoading: focusLoading } = useFocusDistribution(dateStr);
  const { data: activityTags, isLoading: tagsLoading } = useActivityTags(dateStr);
  const { data: topWindows, isLoading: windowsLoading } = useTopWindows(dateStr, 10);

  // Week view data
  const { data: weeklyStats, isLoading: weeklyStatsLoading } = useWeeklyStats(weekStartStr);

  // Month view data
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1; // JavaScript months are 0-indexed
  const { data: monthlyStats, isLoading: monthlyStatsLoading } = useMonthlyStats(year, month);

  // Year view data
  const { data: yearlyStats, isLoading: yearlyStatsLoading } = useYearlyStats(year);

  // Custom range data
  const customStartDate = getDateString(customRange.start);
  const customEndDate = getDateString(customRange.end);
  const { data: customRangeStats, isLoading: customRangeLoading } = useCustomRangeStats(customStartDate, customEndDate);
  const { data: customAppUsage, isLoading: customAppUsageLoading } = useAppUsageRange(customStartTs, customEndTs);
  const { data: customDataSourceStats, isLoading: customDataSourcesLoading } = useDataSourceStatsRange(customStartTs, customEndTs);

  const handleAppClick = (appName: string) => {
    // Navigate to day view filtered by app
    navigate(`/day/${dateStr}?app=${encodeURIComponent(appName)}`);
  };

  const handleWindowClick = (windowTitle: string, appName: string) => {
    // Navigate to day view filtered by window
    navigate(`/day/${dateStr}?window=${encodeURIComponent(windowTitle)}&app=${encodeURIComponent(appName)}`);
  };

  const handleDayClick = (date: string) => {
    // Navigate to Timeline for the clicked date
    const clickedDate = new Date(date);
    // Update the global date context first
    setSelectedDate(clickedDate);
    // Then navigate to Timeline
    navigate('/timeline');
  };

  const handleMonthClick = (monthNumber: number) => {
    // Navigate to Month view for the clicked month
    // Create a date for the first day of that month in the current year
    const targetDate = new Date(year, monthNumber - 1, 1);
    setSelectedDate(targetDate);
    setViewMode('month');
  };

  const handleExport = async (format: 'csv' | 'html' | 'json') => {
    try {
      const content = await api.analytics.exportAnalytics(dateStr, viewMode, format);

      // Create a download
      const blob = new Blob([content], {
        type: format === 'csv' ? 'text/csv' : format === 'html' ? 'text/html' : 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${viewMode}-${dateStr}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Analytics exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export analytics');
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      // Invalidate all analytics queries for the current view
      if (viewMode === 'day') {
        await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.daily(dateStr) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.hourly(dateStr) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.appUsage(0, 0) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.productivityScore(dateStr) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.focusDistribution(dateStr) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.activityTags(dateStr) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.topWindows(dateStr, 10) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.dataSources(0, 0) });
      } else if (viewMode === 'week') {
        await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.weekly(weekStartStr) });
      } else if (viewMode === 'month') {
        await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.monthly(year, month) });
      }

      toast.success('Analytics regenerated successfully');
    } catch (error) {
      console.error('Regenerate failed:', error);
      toast.error('Failed to regenerate analytics');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Short format for mobile, full format for larger screens
  const formattedDateShort = selectedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedDateFull = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header with view toggle and date navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            {viewMode === 'custom' ? (
              `${customRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${customRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            ) : (
              <>
                <span className="sm:hidden">{formattedDateShort}</span>
                <span className="hidden sm:inline">{formattedDateFull}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-10">
              <TabsTrigger value="day" className="text-sm sm:px-3">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-sm sm:px-3">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-sm sm:px-3">Month</TabsTrigger>
              <TabsTrigger value="year" className="text-sm sm:px-3">Year</TabsTrigger>
              <TabsTrigger value="custom" className="text-sm sm:px-3">Custom</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Custom Range Picker */}
          {viewMode === 'custom' && (
            <DateRangePicker
              value={customRange}
              onChange={setCustomRange}
              maxDate={new Date()}
            />
          )}

          {/* Regenerate Button - icon only on mobile */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
          </Button>

          {/* Export Button - icon only on mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('html')}>
                Export as HTML (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Conditional content based on view mode */}
      {viewMode === 'day' && (
        <>
          {/* Stats Grid */}
          <StatsGrid className="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4" stats={stats} isLoading={statsLoading} />

          {/* Productivity Score */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4">
            <ProductivityScoreCard score={productivityScore} isLoading={productivityLoading} />
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="activity" className="space-y-4">
            <TabsList>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="apps">Applications</TabsTrigger>
              <TabsTrigger value="sources">Data Sources</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4">
                <ActivityChart data={hourlyActivity} isLoading={hourlyLoading} />
                <HeatmapChart data={heatmapData} isLoading={heatmapLoading} />
                <FocusDistributionChart data={focusDistribution} isLoading={focusLoading} />
                <ActivityTagsChart data={activityTags} isLoading={tagsLoading} />
              </div>
            </TabsContent>

            <TabsContent value="apps" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4">
                <AppUsageChart data={appUsage} isLoading={appUsageLoading} />
                <TimeDistributionChart
                  data={appUsage}
                  isLoading={appUsageLoading}
                  onAppClick={handleAppClick}
                />
                <AppUsageTable
                  data={appUsage}
                  isLoading={appUsageLoading}
                  onAppClick={handleAppClick}
                />
                <TopWindowsList
                  data={topWindows}
                  isLoading={windowsLoading}
                  onWindowClick={handleWindowClick}
                />
              </div>
            </TabsContent>

            <TabsContent value="sources" className="space-y-4">
              <DataSourcesPanel data={dataSourceStats} isLoading={dataSourcesLoading} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {viewMode === 'week' && (
        <WeeklyAnalytics data={weeklyStats} isLoading={weeklyStatsLoading} onDayClick={handleDayClick} />
      )}

      {viewMode === 'month' && (
        <MonthlyAnalytics data={monthlyStats} isLoading={monthlyStatsLoading} onDayClick={handleDayClick} />
      )}

      {viewMode === 'year' && (
        <YearlyAnalytics data={yearlyStats} isLoading={yearlyStatsLoading} onMonthClick={handleMonthClick} />
      )}

      {viewMode === 'custom' && (
        <>
          {/* Custom Range Analytics with Auto-Bucketing */}
          <CustomRangeAnalytics
            data={customRangeStats as any}
            isLoading={customRangeLoading}
            onDayClick={handleDayClick}
          />

          {/* Additional Custom Range Details */}
          <Tabs defaultValue="apps" className="space-y-4">
            <TabsList>
              <TabsTrigger value="apps">Applications</TabsTrigger>
              <TabsTrigger value="sources">Data Sources</TabsTrigger>
            </TabsList>

            <TabsContent value="apps" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
                <AppUsageChart data={customAppUsage} isLoading={customAppUsageLoading} />
                <AppUsageTable
                  data={customAppUsage}
                  isLoading={customAppUsageLoading}
                  onAppClick={handleAppClick}
                />
              </div>
            </TabsContent>

            <TabsContent value="sources" className="space-y-4">
              <DataSourcesPanel data={customDataSourceStats} isLoading={customDataSourcesLoading} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
