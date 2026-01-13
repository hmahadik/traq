import React, { useState, useMemo } from 'react';
import { GRID_CONSTANTS } from '@/types/timeline';
import { useScreenshotsForDate, useThumbnail } from '@/api/hooks';
import { ImageGallery } from '@/components/common/ImageGallery';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera } from 'lucide-react';
import type { Screenshot } from '@/types';

interface ScreenshotColumnProps {
  date: string;
  hours: number[];
  hourHeight?: number;
}

// Thumbnail component for the grid
function GridThumbnail({
  screenshot,
  onClick
}: {
  screenshot: Screenshot;
  onClick: () => void;
}) {
  const { data: thumbnailUrl, isLoading } = useThumbnail(screenshot.id);

  if (isLoading) {
    return <Skeleton className="w-full h-full rounded" />;
  }

  // Format timestamp for aria-label
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get app name for aria-label
  const appName = screenshot.appName || 'Unknown app';
  const timeStr = formatTime(screenshot.timestamp);

  return (
    <div
      className="w-full h-full rounded overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all group relative"
      onClick={onClick}
      role="button"
      aria-label={`Screenshot from ${appName} at ${timeStr}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <img
        src={thumbnailUrl}
        alt={`Screenshot from ${appName} at ${timeStr}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
    </div>
  );
}

export const ScreenshotColumn: React.FC<ScreenshotColumnProps> = ({
  date,
  hours,
  hourHeight,
}) => {
  const effectiveHourHeight = hourHeight || GRID_CONSTANTS.HOUR_HEIGHT_PX;
  const { data: screenshots, isLoading } = useScreenshotsForDate(date);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Group screenshots by hour
  const screenshotsByHour = useMemo(() => {
    if (!screenshots) return {};

    const grouped: Record<number, Screenshot[]> = {};
    screenshots.forEach((screenshot: Screenshot) => {
      const hour = new Date(screenshot.timestamp * 1000).getHours();
      if (!grouped[hour]) {
        grouped[hour] = [];
      }
      grouped[hour].push(screenshot);
    });

    // Sort screenshots within each hour by timestamp
    Object.keys(grouped).forEach((hour) => {
      grouped[parseInt(hour)].sort((a, b) => a.timestamp - b.timestamp);
    });

    return grouped;
  }, [screenshots]);

  // Get all screenshots for the selected hour (for gallery)
  const galleryScreenshots = useMemo(() => {
    if (selectedHour === null) return screenshots || [];
    return screenshotsByHour[selectedHour] || [];
  }, [selectedHour, screenshotsByHour, screenshots]);

  const openGallery = (hour: number, index: number = 0) => {
    setSelectedHour(hour);
    setSelectedIndex(index);
    setGalleryOpen(true);
  };

  const totalScreenshots = screenshots?.length || 0;

  return (
    <>
      <div
        className="flex-shrink-0 border-r border-border"
        style={{ width: '100px' }}
      >
        {/* Column Header - Fixed height */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
          <div className="flex items-center gap-1.5 w-full min-w-0">
            <div className="w-5 h-5 rounded bg-violet-500 flex items-center justify-center flex-shrink-0">
              <Camera className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1 min-w-0 truncate text-xs font-medium text-foreground">Screens</div>
            <div className="text-[10px] text-muted-foreground flex-shrink-0">{totalScreenshots}</div>
          </div>
        </div>

        {/* Hour Blocks with Screenshots */}
        <div className="relative bg-card">
          {hours.map((hour, index) => {
            const hourScreenshots = screenshotsByHour[hour] || [];
            const count = hourScreenshots.length;

            return (
              <div
                key={hour}
                className={`relative border-b border-border p-1 ${
                  index % 2 === 0 ? 'bg-card' : 'bg-muted/30'
                }`}
                style={{ height: `${effectiveHourHeight}px` }}
              >
                {isLoading ? (
                  <div className="flex gap-1 h-full">
                    <Skeleton className="flex-1 h-full rounded" />
                  </div>
                ) : count > 0 ? (
                  <div className="flex gap-1 h-full">
                    {/* Show up to 2 thumbnails */}
                    {hourScreenshots.slice(0, 2).map((screenshot, idx) => (
                      <div key={screenshot.id} className="flex-1 h-full">
                        <GridThumbnail
                          screenshot={screenshot}
                          onClick={() => openGallery(hour, idx)}
                        />
                      </div>
                    ))}

                    {/* Count badge if more than 2 */}
                    {count > 2 && (
                      <div
                        className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full cursor-pointer hover:bg-black/90 transition-colors"
                        onClick={() => openGallery(hour, 0)}
                        role="button"
                        aria-label={`View all ${count} screenshots for this hour`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openGallery(hour, 0);
                          }
                        }}
                      >
                        +{count - 2}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Empty state - subtle grid pattern */
                  <div
                    className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
                      backgroundSize: '8px 8px',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Image Gallery Modal */}
      <ImageGallery
        screenshots={galleryScreenshots}
        initialIndex={selectedIndex}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />
    </>
  );
};
