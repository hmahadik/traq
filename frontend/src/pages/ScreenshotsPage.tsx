import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useScreenshotsForDate, useScreenshotsForHour } from '@/api/hooks';
import { DatePicker } from '@/components/common/DatePicker';
import { HourGroupWithScreenshots, HourGroupSkeleton } from '@/components/timeline';
import { ImageGallery } from '@/components/common/ImageGallery';
import type { Screenshot } from '@/types';

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

export function ScreenshotsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryHour, setGalleryHour] = useState<number>(0);

  const dateStr = getDateString(selectedDate);
  const isToday = dateStr === getDateString(new Date());

  // Fetch all screenshots for the day to determine active hours
  const { data: screenshots, isLoading } = useScreenshotsForDate(dateStr);

  // Calculate active hours from screenshots
  const activeHours = useMemo(() => {
    if (!screenshots || screenshots.length === 0) return [];

    const hoursSet = new Set<number>();
    screenshots.forEach((screenshot) => {
      const hour = new Date(screenshot.timestamp * 1000).getHours();
      hoursSet.add(hour);
    });

    return Array.from(hoursSet).sort((a, b) => a - b);
  }, [screenshots]);

  // Navigation handlers
  const goToPreviousDay = useCallback(() => {
    setSelectedDate((d) => addDays(d, -1));
  }, []);

  const goToNextDay = useCallback(() => {
    if (!isToday) {
      setSelectedDate((d) => addDays(d, 1));
    }
  }, [isToday]);

  const handleDateChange = useCallback((newDate: Date) => {
    setSelectedDate(newDate);
  }, []);

  const handleScreenshotClick = useCallback(
    (hour: number, screenshot: Screenshot, index: number) => {
      setGalleryHour(hour);
      setGalleryIndex(index);
      setGalleryOpen(true);
    },
    []
  );

  // Fetch screenshots for the gallery hour
  const { data: galleryHourData } = useScreenshotsForHour(dateStr, galleryHour);

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

  const totalScreenshots = screenshots?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Screenshots</h1>
          <p className="text-muted-foreground">
            <span className="sm:hidden">{formattedDateShort}</span>
            <span className="hidden sm:inline">{formattedDateFull}</span>
            <span className="text-muted-foreground/60 ml-2">
              · {totalScreenshots} screenshots · {activeHours.length} active hours
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DatePicker
            value={selectedDate}
            onChange={handleDateChange}
            maxDate={new Date()}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextDay}
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant={isToday ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Hour Groups */}
      {isLoading ? (
        <HourGroupSkeleton count={5} />
      ) : activeHours.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No screenshots found</p>
          <p className="text-sm mt-1">No screenshots captured on this day</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeHours.map((hour) => (
            <HourGroupWithScreenshots
              key={hour}
              date={dateStr}
              hour={hour}
              onScreenshotClick={(screenshot, index) =>
                handleScreenshotClick(hour, screenshot, index)
              }
              defaultExpanded={false}
            />
          ))}
        </div>
      )}

      {/* Image Gallery */}
      <ImageGallery
        screenshots={galleryHourData || []}
        initialIndex={galleryIndex}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />
    </div>
  );
}
