import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionsForDate } from '@/api/hooks';
import { formatDate, addDays, toDateString, groupBy } from '@/lib/utils';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { DatePicker } from '@/components/common/DatePicker';
import { HourGroup, HourGroupSkeleton } from '@/components/timeline/HourGroup';
import { ImageGallery } from '@/components/common/ImageGallery';
import type { Screenshot } from '@/types';

export function DayPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const currentDate = date ? new Date(date) : new Date();
  const dateString = toDateString(currentDate);

  const { data: sessions, isLoading } = useSessionsForDate(dateString);

  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryScreenshots, setGalleryScreenshots] = useState<Screenshot[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Flatten all screenshots from sessions and group by hour
  const screenshotsByHour = useMemo(() => {
    if (!sessions) return {};

    // For the mock data, we'll generate screenshots per hour
    // In real implementation, screenshots would come from sessions
    const allScreenshots: Screenshot[] = [];

    // Generate mock screenshots for each hour based on sessions
    sessions.forEach((session) => {
      const startHour = new Date(session.startTime * 1000).getHours();
      const endHour = session.endTime
        ? new Date(session.endTime * 1000).getHours()
        : startHour + 1;

      for (let h = startHour; h <= endHour; h++) {
        const count = Math.floor(Math.random() * 20) + 5;
        for (let i = 0; i < count; i++) {
          const timestamp = session.startTime + (h - startHour) * 3600 + i * 30;
          allScreenshots.push({
            id: session.id * 1000 + h * 100 + i,
            timestamp,
            filepath: `/screenshots/${dateString}/screenshot_${h}_${i}.webp`,
            dhash: `hash_${h}_${i}`,
            windowTitle: ['VS Code - main.go', 'Firefox - GitHub', 'Terminal - ~/projects'][i % 3],
            appName: ['VS Code', 'Firefox', 'Terminal'][i % 3],
            windowX: 0,
            windowY: 0,
            windowWidth: 1920,
            windowHeight: 1080,
            monitorName: 'Primary',
            monitorWidth: 1920,
            monitorHeight: 1080,
            sessionId: session.id,
            createdAt: timestamp,
          });
        }
      }
    });

    return groupBy(allScreenshots, (s) =>
      new Date(s.timestamp * 1000).getHours().toString()
    );
  }, [sessions, dateString]);

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
    (hour: number, _screenshot: Screenshot, index: number) => {
      const hourScreenshots = screenshotsByHour[hour.toString()] || [];
      setGalleryScreenshots(hourScreenshots);
      setGalleryIndex(index);
      setGalleryOpen(true);
    },
    [screenshotsByHour]
  );

  // Keyboard navigation
  useKeyboardNav({
    onLeft: goToPreviousDay,
    onRight: goToNextDay,
  });

  // Get active hours (hours with screenshots)
  const activeHours = useMemo(() => {
    const hours: number[] = [];
    for (let h = 0; h < 24; h++) {
      if (screenshotsByHour[h.toString()]?.length > 0) {
        hours.push(h);
      }
    }
    return hours.length > 0 ? hours : Array.from({ length: 10 }, (_, i) => i + 8);
  }, [screenshotsByHour]);

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
        <span>
          {Object.values(screenshotsByHour).reduce((sum, arr) => sum + arr.length, 0)} screenshots
        </span>
        <span>{sessions?.length || 0} sessions</span>
        <span>{activeHours.length} active hours</span>
      </div>

      {/* Hour Groups */}
      {isLoading ? (
        <HourGroupSkeleton count={5} />
      ) : (
        <div className="space-y-3">
          {activeHours.map((hour) => (
            <HourGroup
              key={hour}
              hour={hour}
              screenshots={screenshotsByHour[hour.toString()] || []}
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
        screenshots={galleryScreenshots}
        initialIndex={galleryIndex}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />
    </div>
  );
}
