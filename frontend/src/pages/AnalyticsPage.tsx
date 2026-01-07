import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/common/DatePicker';
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
} from '@/components/analytics';
import {
  useDailyStats,
  useHourlyActivity,
  useAppUsage,
  useDataSourceStats,
  useProductivityScore,
  useFocusDistribution,
  useActivityTags,
  useTopWindows,
  useWeeklyStats,
  useMonthlyStats,
} from '@/api/hooks';
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/api/client';
import { toast } from 'sonner';

type ViewMode = 'day' | 'week' | 'month';

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
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

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = getDateString(selectedDate);
  const weekStartStr = getDateString(getWeekStart(selectedDate));
  const isToday = dateStr === getDateString(new Date());

  // Day view data
  const { data: stats, isLoading: statsLoading } = useDailyStats(dateStr);
  const { data: hourlyActivity, isLoading: hourlyLoading } = useHourlyActivity(dateStr);
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

  const handlePrevDay = () => {
    setSelectedDate((d) => addDays(d, -1));
  };

  const handleNextDay = () => {
    if (!isToday) {
      setSelectedDate((d) => addDays(d, 1));
    }
  };

  const handleAppClick = (appName: string) => {
    // Navigate to day view filtered by app
    navigate(`/day/${dateStr}?app=${encodeURIComponent(appName)}`);
  };

  const handleWindowClick = (windowTitle: string, appName: string) => {
    // Navigate to day view filtered by window
    navigate(`/day/${dateStr}?window=${encodeURIComponent(windowTitle)}&app=${encodeURIComponent(appName)}`);
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

  const formattedDate = selectedDate.toLocaleDateString('en-US', {
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
          <p className="text-muted-foreground">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="day" className="text-xs px-3">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Date Navigation */}
          <Button variant="outline" size="icon" onClick={handlePrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            trigger={
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                {isToday ? 'Today' : selectedDate.toLocaleDateString()}
              </Button>
            }
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextDay}
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
            >
              Today
            </Button>
          )}

          {/* Export Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
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
          <StatsGrid stats={stats} isLoading={statsLoading} />

          {/* Productivity Score */}
          <div className="grid gap-4 md:grid-cols-2">
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
              <div className="grid gap-4 lg:grid-cols-2">
                <ActivityChart data={hourlyActivity} isLoading={hourlyLoading} />
                <HeatmapChart data={undefined} isLoading={hourlyLoading} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <FocusDistributionChart data={focusDistribution} isLoading={focusLoading} />
                <ActivityTagsChart data={activityTags} isLoading={tagsLoading} />
              </div>
            </TabsContent>

            <TabsContent value="apps" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <AppUsageChart data={appUsage} isLoading={appUsageLoading} />
                <TimeDistributionChart
                  data={appUsage}
                  isLoading={appUsageLoading}
                  onAppClick={handleAppClick}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
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
        <WeeklyAnalytics data={weeklyStats} isLoading={weeklyStatsLoading} />
      )}

      {viewMode === 'month' && (
        <MonthlyAnalytics data={monthlyStats} isLoading={monthlyStatsLoading} />
      )}
    </div>
  );
}
