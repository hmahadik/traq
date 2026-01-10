import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HeatmapData {
  dayOfWeek: number; // 0 = Sunday
  hour: number; // 0-23
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapData[] | undefined;
  isLoading: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getIntensityClass(value: number, max: number): string {
  if (value === 0) return 'bg-muted';
  const ratio = value / max;
  if (ratio < 0.25) return 'bg-green-200 dark:bg-green-900/40';
  if (ratio < 0.5) return 'bg-green-400 dark:bg-green-700/60';
  if (ratio < 0.75) return 'bg-green-500 dark:bg-green-600/80';
  return 'bg-green-600 dark:bg-green-500';
}

export function HeatmapChart({ data, isLoading }: HeatmapChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Use provided data or empty array
  const heatmapData: HeatmapData[] = data || [];

  const maxValue = heatmapData.length > 0 ? Math.max(...heatmapData.map((d) => d.value)) : 0;

  const getValue = (day: number, hour: number) => {
    const item = heatmapData.find((d) => d.dayOfWeek === day && d.hour === hour);
    return item?.value ?? 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex mb-1 ml-12">
                {HOURS.filter((h) => h % 3 === 0).map((hour) => (
                  <div
                    key={hour}
                    className="text-xs text-muted-foreground"
                    style={{ width: `${100 / 8}%` }}
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="space-y-1">
                {DAYS.map((day, dayIndex) => (
                  <div key={day} className="flex items-center gap-1">
                    <div className="w-10 text-sm font-medium text-foreground/70 text-right pr-2">
                      {day}
                    </div>
                    <div className="flex-1 flex gap-[2px]">
                      {HOURS.map((hour) => {
                        const value = getValue(dayIndex, hour);
                        return (
                          <Tooltip key={hour}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'flex-1 h-5 rounded-sm cursor-pointer transition-colors hover:ring-1 ring-foreground/20',
                                  getIntensityClass(value, maxValue)
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">
                                {day} {hour.toString().padStart(2, '0')}:00
                              </p>
                              <p className="text-muted-foreground">
                                {value} min active
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
                <span>Less</span>
                <div className="flex gap-[2px]">
                  <div className="w-3 h-3 rounded-sm bg-muted" />
                  <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/40" />
                  <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700/60" />
                  <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-600/80" />
                  <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-500" />
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
