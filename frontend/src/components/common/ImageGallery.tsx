import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useScreenshotImage, useThumbnail } from '@/api/hooks';
import { formatTimestamp, formatDate, isNullableValid, getNullableInt, getNullableString } from '@/lib/utils';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { Skeleton } from '@/components/ui/skeleton';
import type { Screenshot } from '@/types';

// Small thumbnail for the strip
function GalleryThumbnail({ screenshot }: { screenshot: Screenshot }) {
  const { data: thumbnailUrl, isLoading } = useThumbnail(screenshot.id);

  if (isLoading) {
    return <Skeleton className="w-full h-full" />;
  }

  return (
    <img
      src={thumbnailUrl}
      alt=""
      className="w-full h-full object-cover"
    />
  );
}

interface ImageGalleryProps {
  screenshots: Screenshot[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageGallery({
  screenshots,
  initialIndex = 0,
  open,
  onOpenChange,
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  const currentScreenshot = screenshots[currentIndex];
  const { data: imageUrl, isLoading } = useScreenshotImage(currentScreenshot?.id ?? 0);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : screenshots.length - 1));
    setZoom(1);
  }, [screenshots.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < screenshots.length - 1 ? prev + 1 : 0));
    setZoom(1);
  }, [screenshots.length]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setZoom(1);
  }, [onOpenChange]);

  const toggleZoom = useCallback(() => {
    setZoom((prev) => (prev === 1 ? 2 : 1));
  }, []);

  // Reset index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Keyboard navigation
  useKeyboardNav({
    onLeft: goToPrevious,
    onRight: goToNext,
    onEscape: handleClose,
    enabled: open,
  });

  if (!currentScreenshot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="image-gallery" className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="text-white">
            <p className="text-sm font-medium">
              {formatDate(currentScreenshot.timestamp)} {formatTimestamp(currentScreenshot.timestamp)}
            </p>
            <p className="text-xs text-white/70">
              {currentScreenshot.appName} - {currentScreenshot.windowTitle}
            </p>
            {/* Window Class */}
            {isNullableValid(currentScreenshot.windowClass) && (
              <p className="text-xs text-white/60 mt-0.5">
                Class: {getNullableString(currentScreenshot.windowClass)}
              </p>
            )}
            {/* Window Geometry Metadata */}
            {isNullableValid(currentScreenshot.windowX) && isNullableValid(currentScreenshot.windowY) && (
              <p className="text-xs text-white/50 mt-1">
                Position: ({getNullableInt(currentScreenshot.windowX)}, {getNullableInt(currentScreenshot.windowY)}) |
                Size: {getNullableInt(currentScreenshot.windowWidth)} × {getNullableInt(currentScreenshot.windowHeight)}
                {isNullableValid(currentScreenshot.processPid) && (
                  <> | PID: {getNullableInt(currentScreenshot.processPid)}</>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/70">
              {currentIndex + 1} / {screenshots.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={toggleZoom}
            >
              {zoom === 1 ? (
                <ZoomIn className="h-5 w-5" />
              ) : (
                <ZoomOut className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Main Image */}
        <div className="flex items-center justify-center h-[85vh] overflow-auto">
          {isLoading ? (
            <Skeleton className="w-[80vw] aspect-video" />
          ) : (
            <img
              src={imageUrl}
              alt={currentScreenshot.windowTitle || 'Screenshot'}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <Button
          data-testid="gallery-prev"
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
          onClick={goToPrevious}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
        <Button
          data-testid="gallery-next"
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
          onClick={goToNext}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>

        {/* Thumbnail Strip */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex gap-2 justify-center overflow-x-auto max-w-full py-2">
            {screenshots.slice(
              Math.max(0, currentIndex - 5),
              Math.min(screenshots.length, currentIndex + 6)
            ).map((screenshot, idx) => {
              const actualIndex = Math.max(0, currentIndex - 5) + idx;
              return (
                <div
                  key={screenshot.id}
                  className={`flex-shrink-0 w-16 aspect-video rounded overflow-hidden cursor-pointer transition-all ${
                    actualIndex === currentIndex
                      ? 'ring-2 ring-primary'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  onClick={() => {
                    setCurrentIndex(actualIndex);
                    setZoom(1);
                  }}
                >
                  <GalleryThumbnail screenshot={screenshot} />
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
