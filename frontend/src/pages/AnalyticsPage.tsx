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
} from '@/components/analytics';
import {
  useDailyStats,
  useHourlyActivity,
  useAppUsage,
  useDataSourceStats,
  useProductivityScore,
  useFocusDistribution,
  useActivityTags,
} from '@/api/hooks';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = getDateString(selectedDate);
  const isToday = dateStr === getDateString(new Date());

  const { data: stats, isLoading: statsLoading } = useDailyStats(dateStr);
  const { data: hourlyActivity, isLoading: hourlyLoading } = useHourlyActivity(dateStr);
  const { data: appUsage, isLoading: appUsageLoading } = useAppUsage(dateStr);
  const { data: dataSourceStats, isLoading: dataSourcesLoading } = useDataSourceStats(dateStr);
  const { data: productivityScore, isLoading: productivityLoading } = useProductivityScore(dateStr);
  const { data: focusDistribution, isLoading: focusLoading } = useFocusDistribution(dateStr);
  const { data: activityTags, isLoading: tagsLoading } = useActivityTags(dateStr);

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

  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header with date navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

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
            <AppUsageTable
              data={appUsage}
              isLoading={appUsageLoading}
              onAppClick={handleAppClick}
            />
          </div>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <DataSourcesPanel data={dataSourceStats} isLoading={dataSourcesLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
