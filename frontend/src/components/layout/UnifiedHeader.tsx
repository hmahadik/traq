import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Settings, Pause, Play } from 'lucide-react';
import { useDateContext } from '@/contexts';
import { CalendarWidget } from '@/components/timeline';
import { useCalendarHeatmap } from '@/api/hooks';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { api } from '@/api/client';

interface UnifiedHeaderProps {
  onSettingsClick: () => void;
}

export function UnifiedHeader({ onSettingsClick }: UnifiedHeaderProps) {
  const {
    selectedDate,
    setSelectedDate,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    goToYesterday,
    isToday,
  } = useDateContext();

  const [showCalendar, setShowCalendar] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const { data: calendarData, isLoading: calendarLoading } = useCalendarHeatmap(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1
  );

  const formattedDateFull = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const handleTogglePause = async () => {
    try {
      if (isPaused) {
        await api.config.resumeCapture();
        setIsPaused(false);
        toast.success('Capture resumed', {
          description: 'Screenshot capture is now active',
        });
      } else {
        await api.config.pauseCapture();
        setIsPaused(true);
        toast.success('Capture paused', {
          description: 'Screenshot capture is temporarily paused',
        });
      }
    } catch (error) {
      toast.error('Failed to toggle pause', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    selectedDate.toDateString() === yesterday.toDateString();

  return (
    <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: Date Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToPreviousDay}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              className="h-8 px-3 font-medium min-w-[140px] justify-start"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {formattedDateFull}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextDay}
              disabled={isToday}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Calendar Dropdown */}
            {showCalendar && (
              <div className="absolute top-full left-12 mt-2 z-50 bg-background border rounded-lg shadow-lg p-4">
                <CalendarWidget
                  data={calendarData}
                  isLoading={calendarLoading}
                  selectedDate={selectedDate}
                  onSelectDate={handleDateSelect}
                />
              </div>
            )}
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1">
            <Button
              variant={isToday ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={goToToday}
            >
              Today
            </Button>
            <Button
              variant={isYesterday ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={goToYesterday}
            >
              Yesterday
            </Button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              isPaused && 'text-yellow-500 hover:text-yellow-600'
            )}
            onClick={handleTogglePause}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onSettingsClick}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
