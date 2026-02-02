import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker, type DateRange, DateNavigation } from '@/components/common';
import { useDateContext } from '@/contexts';
import {
  StatsGrid,
  ActivityChart,
  AppUsageChart,
  AppUsageTable,
  ProjectUsageChart,
  ProjectUsageTable,
  WindowTitlesChart,
  TopWindowsList,
  WeeklyAnalytics,
  MonthlyAnalytics,
  YearlyAnalytics,
  CustomRangeAnalytics,
} from '@/components/analytics';
import {
  useDailyStats,
  useHourlyActivity,
  useAppUsage,
  useAppUsageRange,
  useProjectUsage,
  useProjectUsageRange,
  useTopWindows,
  useTopWindowsRange,
  useWeeklyStats,
  useMonthlyStats,
  useYearlyStats,
  useCustomRangeStats,
} from '@/api/hooks';
import { Download } from 'lucide-react';
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
  const diff = result.getDate() - day;
  return new Date(result.setDate(diff));
}

function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  return addDays(weekStart, 6);
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
  const { selectedDate, setTimeframeType, setSelectedDate, setDateRange } = useDateContext();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { start, end };
  });

  useEffect(() => {
    setTimeframeType(viewMode as any);

    switch (viewMode) {
      case 'day':
        setDateRange(null);
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

  // Calculate custom range timestamps
  const customStartTs = Math.floor(new Date(customRange.start.getFullYear(), customRange.start.getMonth(), customRange.start.getDate(), 0, 0, 0, 0).getTime() / 1000);
  const customEndTs = Math.floor(new Date(customRange.end.getFullYear(), customRange.end.getMonth(), customRange.end.getDate(), 23, 59, 59, 999).getTime() / 1000);

  // Day view data
  const { data: stats, isLoading: statsLoading } = useDailyStats(dateStr, true); // Enable comparison
  const { data: hourlyActivity, isLoading: hourlyLoading } = useHourlyActivity(dateStr);
  const { data: appUsage, isLoading: appUsageLoading } = useAppUsage(dateStr);
  const { data: projectUsage, isLoading: projectUsageLoading } = useProjectUsage(dateStr);
  const { data: topWindows, isLoading: topWindowsLoading } = useTopWindows(dateStr, 10);

  // Week view data
  const { data: weeklyStats, isLoading: weeklyStatsLoading } = useWeeklyStats(weekStartStr);
  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);
  const weekStartTs = Math.floor(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0, 0).getTime() / 1000);
  const weekEndTs = Math.floor(new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999).getTime() / 1000);
  const { data: weeklyAppUsage, isLoading: weeklyAppUsageLoading } = useAppUsageRange(weekStartTs, weekEndTs);
  const { data: weeklyProjectUsage, isLoading: weeklyProjectUsageLoading } = useProjectUsageRange(weekStartTs, weekEndTs);
  const { data: weeklyTopWindows, isLoading: weeklyTopWindowsLoading } = useTopWindowsRange(weekStartTs, weekEndTs, 10);

  // Month view data
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;
  const { data: monthlyStats, isLoading: monthlyStatsLoading } = useMonthlyStats(year, month);

  // Year view data
  const { data: yearlyStats, isLoading: yearlyStatsLoading } = useYearlyStats(year);

  // Custom range data
  const customStartDate = getDateString(customRange.start);
  const customEndDate = getDateString(customRange.end);
  const { data: customRangeStats, isLoading: customRangeLoading } = useCustomRangeStats(customStartDate, customEndDate);
  const { data: customAppUsage, isLoading: customAppUsageLoading } = useAppUsageRange(customStartTs, customEndTs);
  const { data: customProjectUsage, isLoading: customProjectUsageLoading } = useProjectUsageRange(customStartTs, customEndTs);
  const { data: customTopWindows, isLoading: customTopWindowsLoading } = useTopWindowsRange(customStartTs, customEndTs, 10);

  const handleAppClick = (appName: string) => {
    navigate(`/timeline?app=${encodeURIComponent(appName)}`);
  };

  const handleDayClick = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    const clickedDate = new Date(y, m - 1, d);
    setSelectedDate(clickedDate);
    navigate('/timeline');
  };

  const handleMonthClick = (monthNumber: number) => {
    const targetDate = new Date(year, monthNumber - 1, 1);
    setSelectedDate(targetDate);
    setViewMode('month');
  };

  const handleExport = async (format: 'csv' | 'html' | 'json') => {
    try {
      const content = await api.analytics.exportAnalytics(dateStr, viewMode, format);

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

  const getSubtitle = (): string => {
    switch (viewMode) {
      case 'day':
        return selectedDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'week': {
        const ws = getWeekStart(selectedDate);
        const we = getWeekEnd(selectedDate);
        const startStr = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `Week of ${startStr} - ${endStr}`;
      }
      case 'month':
        return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'year':
        return String(selectedDate.getFullYear());
      case 'custom': {
        const startStr = customRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = customRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${startStr} - ${endStr}`;
      }
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">{getSubtitle()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-10">
              <TabsTrigger value="day" className="text-sm sm:px-3">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-sm sm:px-3">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-sm sm:px-3">Month</TabsTrigger>
              <TabsTrigger value="year" className="text-sm sm:px-3">Year</TabsTrigger>
              <TabsTrigger value="custom" className="text-sm sm:px-3">Custom</TabsTrigger>
            </TabsList>
          </Tabs>

          <DateNavigation />

          {viewMode === 'custom' && (
            <DateRangePicker
              value={customRange}
              onChange={setCustomRange}
              maxDate={new Date()}
            />
          )}

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
                Export as HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <StatsGrid
              stats={stats}
              isLoading={statsLoading}
              className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4"
            />
            <ActivityChart data={hourlyActivity} isLoading={hourlyLoading} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ProjectUsageChart data={projectUsage} isLoading={projectUsageLoading} />
            <ProjectUsageTable data={projectUsage} isLoading={projectUsageLoading} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <AppUsageChart data={appUsage} isLoading={appUsageLoading} />
            <AppUsageTable data={appUsage} isLoading={appUsageLoading} onAppClick={handleAppClick} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <WindowTitlesChart data={topWindows} isLoading={topWindowsLoading} />
            <TopWindowsList data={topWindows} isLoading={topWindowsLoading} />
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="space-y-6">
          <WeeklyAnalytics data={weeklyStats} isLoading={weeklyStatsLoading} onDayClick={handleDayClick} />

          {(weeklyProjectUsageLoading || (weeklyProjectUsage && weeklyProjectUsage.length > 0)) && (
            <div className="grid gap-4 md:grid-cols-2">
              <ProjectUsageChart data={weeklyProjectUsage} isLoading={weeklyProjectUsageLoading} />
              <ProjectUsageTable data={weeklyProjectUsage} isLoading={weeklyProjectUsageLoading} />
            </div>
          )}

          {(weeklyAppUsageLoading || (weeklyAppUsage && weeklyAppUsage.length > 0)) && (
            <div className="grid gap-4 md:grid-cols-2">
              <AppUsageChart data={weeklyAppUsage} isLoading={weeklyAppUsageLoading} />
              <AppUsageTable data={weeklyAppUsage} isLoading={weeklyAppUsageLoading} onAppClick={handleAppClick} />
            </div>
          )}

          {(weeklyTopWindowsLoading || (weeklyTopWindows && weeklyTopWindows.length > 0)) && (
            <div className="grid gap-4 md:grid-cols-2">
              <WindowTitlesChart data={weeklyTopWindows} isLoading={weeklyTopWindowsLoading} />
              <TopWindowsList data={weeklyTopWindows} isLoading={weeklyTopWindowsLoading} />
            </div>
          )}
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <MonthlyAnalytics data={monthlyStats} isLoading={monthlyStatsLoading} onDayClick={handleDayClick} />
      )}

      {/* Year View */}
      {viewMode === 'year' && (
        <YearlyAnalytics data={yearlyStats} isLoading={yearlyStatsLoading} onMonthClick={handleMonthClick} />
      )}

      {/* Custom Range View */}
      {viewMode === 'custom' && (
        <div className="space-y-6">
          <CustomRangeAnalytics
            data={customRangeStats as any}
            isLoading={customRangeLoading}
            onDayClick={handleDayClick}
          />

          {(customProjectUsageLoading || (customProjectUsage && customProjectUsage.length > 0)) && (
            <div className="grid gap-4 md:grid-cols-2">
              <ProjectUsageChart data={customProjectUsage} isLoading={customProjectUsageLoading} />
              <ProjectUsageTable data={customProjectUsage} isLoading={customProjectUsageLoading} />
            </div>
          )}

          {(customAppUsageLoading || (customAppUsage && customAppUsage.length > 0)) && (
            <div className="grid gap-4 md:grid-cols-2">
              <AppUsageChart data={customAppUsage} isLoading={customAppUsageLoading} />
              <AppUsageTable data={customAppUsage} isLoading={customAppUsageLoading} onAppClick={handleAppClick} />
            </div>
          )}

          {(customTopWindowsLoading || (customTopWindows && customTopWindows.length > 0)) && (
            <div className="grid gap-4 md:grid-cols-2">
              <WindowTitlesChart data={customTopWindows} isLoading={customTopWindowsLoading} />
              <TopWindowsList data={customTopWindows} isLoading={customTopWindowsLoading} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
