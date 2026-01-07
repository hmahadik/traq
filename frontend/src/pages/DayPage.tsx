import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionsForDate, useScreenshotsForHour } from '@/api/hooks';
import { formatDate, addDays, toDateString, parseDateString } from '@/lib/utils';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { DatePicker } from '@/components/common/DatePicker';
import { HourGroupWithScreenshots, HourGroupSkeleton } from '@/components/timeline';
import { ImageGallery } from '@/components/common/ImageGallery';
import type { Screenshot } from '@/types';

export function DayPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const currentDate = date ? parseDateString(date) : new Date();
  const dateString = toDateString(currentDate);

  const { data: sessions, isLoading } = useSessionsForDate(dateString);

  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryHour, setGalleryHour] = useState<number>(0);

  // Calculate active hours from sessions (hours when there was activity)
  const activeHours = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];

    const hoursSet = new Set<number>();
    sessions.forEach((session) => {
      const startHour = new Date(session.startTime * 1000).getHours();
      const endHour = session.endTime
        ? new Date(session.endTime * 1000).getHours()
        : startHour;

      for (let h = startHour; h <= endHour; h++) {
        hoursSet.add(h);
      }
    });

    return Array.from(hoursSet).sort((a, b) => a - b);
  }, [sessions]);

  const goToPreviousDay = useCallback(() => {
    const newDate = addDays(currentDate, -1);
    navigate(`/day/${toDateString(newDate)}`);
  }, [currentDate, navigate]);

  const goToNextDay = useCallback(() => {
    const newDate = addDays(currentDate, 1);
    navigate(`/day/${toDateString(newDate)}`);
  }, [currentDate, navigate]);

  const handleDateChange = useCallback(
    (newDate: Date) => {
      navigate(`/day/${toDateString(newDate)}`);
    },
    [navigate]
  );

  const handleScreenshotClick = useCallback(
    (hour: number, screenshot: Screenshot, index: number) => {
      // Gallery will need to fetch screenshots for this hour
      setGalleryHour(hour);
      setGalleryIndex(index);
      setGalleryOpen(true);
    },
    []
  );

  // Fetch screenshots for the gallery hour
  const { data: galleryHourData } = useScreenshotsForHour(dateString, galleryHour);

  // Keyboard navigation
  useKeyboardNav({
    onLeft: goToPreviousDay,
    onRight: goToNextDay,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">
            {formatDate(currentDate.getTime() / 1000)}
          </h1>
          <DatePicker
            value={currentDate}
            onChange={handleDateChange}
            maxDate={new Date()}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextDay}
          disabled={toDateString(currentDate) === toDateString(new Date())}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span>{sessions?.length || 0} sessions</span>
        <span>{activeHours.length} active hours</span>
      </div>

      {/* Hour Groups */}
      {isLoading ? (
        <HourGroupSkeleton count={5} />
      ) : activeHours.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No activity recorded</p>
          <p className="text-sm mt-1">No screenshots captured on this day</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeHours.map((hour) => (
            <HourGroupWithScreenshots
              key={hour}
              date={dateString}
              hour={hour}
              onScreenshotClick={(screenshot, index) =>
                handleScreenshotClick(hour, screenshot, index)
              }
              defaultExpanded={activeHours.length <= 5}
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
