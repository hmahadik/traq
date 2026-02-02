import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarData, CalendarDay } from '@/types';

interface CalendarWidgetProps {
  data: CalendarData | undefined;
  isLoading: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange?: (year: number, month: number) => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getIntensityClass(value: number, maxValue: number): string {
  if (value === 0) return '';
  const ratio = value / maxValue;
  if (ratio < 0.25) return 'bg-primary/20';
  if (ratio < 0.5) return 'bg-primary/40';
  if (ratio < 0.75) return 'bg-primary/60';
  return 'bg-primary/80';
}

export function CalendarWidget({
  data,
  isLoading,
  selectedDate,
  onSelectDate,
  onMonthChange,
}: CalendarWidgetProps) {
  const [viewDate, setViewDate] = useState(selectedDate);

  // Sync viewDate when selectedDate changes externally (e.g., keyboard navigation)
  useEffect(() => {
    setViewDate(selectedDate);
  }, [selectedDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // Create a map of date string to activity data
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    data?.days?.forEach((d: CalendarDay) => {
      map.set(d.date, d.screenshotCount);
    });
    return map;
  }, [data]);

  const maxActivity = useMemo(() => {
    return Math.max(...(data?.days?.map((d: CalendarDay) => d.screenshotCount) || [1]), 1);
  }, [data]);

  const goToPreviousMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setViewDate(newDate);
    onMonthChange?.(newDate.getFullYear(), newDate.getMonth() + 1);
  };

  const goToNextMonth = () => {
    if (isCurrentMonth) return;
    const newDate = new Date(year, month + 1, 1);
    setViewDate(newDate);
    onMonthChange?.(newDate.getFullYear(), newDate.getMonth() + 1);
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(year, month, day);
    if (newDate <= new Date()) {
      onSelectDate(newDate);
    }
  };

  const isToday = (day: number) => {
    return isSameDay(new Date(year, month, day), new Date());
  };

  const isSelected = (day: number) => {
    return isSameDay(new Date(year, month, day), selectedDate);
  };

  const isFuture = (day: number) => {
    return new Date(year, month, day) > new Date();
  };

  const getDateKey = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // Generate calendar grid
  const days: (number | null)[] = [];
  for (let i = 0; i < startPadding; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="calendar-widget">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[7rem] text-center whitespace-nowrap">
              {MONTHS[month]} {year}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map((day, i) => (
            <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <div key={index} className="aspect-square">
              {day !== null && (
                <button
                  onClick={() => handleDateClick(day)}
                  disabled={isFuture(day)}
                  className={cn(
                    'w-full h-full rounded text-xs flex items-center justify-center transition-all relative',
                    isSelected(day)
                      ? 'bg-primary text-primary-foreground font-medium'
                      : isToday(day)
                      ? 'ring-1 ring-primary'
                      : 'hover:bg-accent',
                    isFuture(day) && 'opacity-30 cursor-not-allowed',
                    !isSelected(day) && getIntensityClass(activityMap.get(getDateKey(day)) || 0, maxActivity)
                  )}
                >
                  {day}
                  {activityMap.get(getDateKey(day)) !== undefined && !isSelected(day) && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-3 pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={() => onSelectDate(new Date())}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={() => {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              onSelectDate(yesterday);
            }}
          >
            Yesterday
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
