import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useScreenshotImage, useThumbnail } from '@/api/hooks';
import { formatTimestamp, formatDate, isNullableValid, getNullableInt, getNullableString } from '@/lib/utils';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { useDebounce } from '@/hooks/useDebounce';
import { useHoldScrub } from '@/hooks/useHoldScrub';
import { useScrubImageCache, PROXY_MAX_DIMENSION } from '@/hooks/useScrubImageCache';
import { Skeleton } from '@/components/ui/skeleton';
import type { Screenshot } from '@/types';

// Small thumbnail for the strip; memoized so held-key navigation only pays
// for the one thumbnail entering the ±5 window, not all eleven
const GalleryThumbnail = memo(function GalleryThumbnail({
  screenshot,
}: {
  screenshot: Screenshot;
}) {
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
});

// Intrinsic size of anything the scrub canvas can draw
function sourceDimensions(
  source: HTMLCanvasElement | HTMLImageElement | null
): [number, number] {
  if (!source) return [0, 0];
  return source instanceof HTMLCanvasElement
    ? [source.width, source.height]
    : [source.naturalWidth, source.naturalHeight];
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
  const [zoom, setZoom] = useState(1);
  // Held-key navigation, paced to what this engine can paint. Owns the index
  // so the pacer can coalesce several key repeats into one applied step.
  const paintedInHoldRef = useRef(false);
  const { currentIndex, setCurrentIndex, isHolding, goToPrevious, goToNext, strideRef } =
    useHoldScrub({
      open,
      count: screenshots.length,
      initialIndex,
      onStep: useCallback(() => setZoom(1), []),
      // The canvas may only hold its last frame for the duration of one hold
      onHoldEnd: useCallback(() => {
        paintedInHoldRef.current = false;
      }, []),
    });

  // The debounced index only gates the base image query; the scrub cache below
  // serves full-res frames at key-repeat speed when they're already decoded.
  // An active hold session counts as scrubbing outright — the tick cadence can
  // straddle the debounce window, and flickering into "settled" mid-hold would
  // pay a full-resolution paint per frame
  const debouncedIndex = useDebounce(currentIndex, 150);
  const isScrubbing = isHolding || currentIndex !== debouncedIndex;

  const currentScreenshot = screenshots[currentIndex];
  // Fall back to the live screenshot if the debounced index is stale for a new screenshot set
  const settledScreenshot = screenshots[debouncedIndex] ?? currentScreenshot;
  const { data: imageUrl, isLoading } = useScreenshotImage(settledScreenshot?.id ?? 0);
  // Thumbnails in the strip's ±5 window are already cached, so this is a cache
  // hit. Deliberately independent of the scrub cache's decoded thumbnail: this
  // one resolves even when every decode slot is stalled, which is the case
  // where the viewer would otherwise go blank.
  const { data: scrubPreviewUrl } = useThumbnail(currentScreenshot?.id ?? 0);

  // Decode-ahead pipeline: pre-decodes full-res frames around the current index
  // (direction-aware, bounded concurrency) so held arrow keys flip through
  // full-res images; falls back to the thumbnail only when the decoder is outrun
  const getCacheEntry = useScrubImageCache(screenshots, currentIndex, open, strideRef);
  const cacheEntry = currentScreenshot ? getCacheEntry(currentScreenshot.id) : null;

  // Scrub frames are drawn into one long-lived, compositor-promoted canvas.
  // Writing a small bitmap into the same element only re-uploads that layer,
  // whereas swapping in a different <img>/<canvas> per frame costs a layout
  // plus a full-viewport re-raster — and on WebKitGTK every paint blocks key
  // delivery, so per-frame cost is what makes a held key run away.
  const [canvasUsable, setCanvasUsable] = useState(true);
  // Sharpest copy that is actually ready for THIS frame. A held key outruns
  // 130ms full-res decodes, so most painted frames during a fast scrub are
  // thumbnails — showing them is what makes the picture move with the counter
  // instead of freezing until release.
  const scrubSource = cacheEntry
    ? cacheEntry.proxy ?? cacheEntry.image ?? cacheEntry.thumb
    : null;
  const [sourceWidth, sourceHeight] = sourceDimensions(scrubSource);
  // Only if nothing at all is ready do we hold the last painted frame
  const usingCanvas =
    canvasUsable &&
    isScrubbing &&
    ((sourceWidth > 0 && sourceHeight > 0) || paintedInHoldRef.current);

  // At rest, mount the pre-decoded full-res node itself (WebKitGTK re-decodes
  // when a different <img> merely shares the URL). Without the canvas path
  // this also carries scrubbing, as it did before.
  const hostElement =
    usingCanvas || !cacheEntry
      ? null
      : isScrubbing
        ? cacheEntry.proxy ?? cacheEntry.image
        : cacheEntry.image;
  // Frames whose full-res bitmap was released still render from their blob;
  // the settled query covers frames the scrub cache never held
  const settledUrl = cacheEntry?.url ?? (isLoading ? null : imageUrl);

  // Host the cached pre-decoded element directly; React renders the container
  // and never touches its children
  const imageHostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = imageHostRef.current;
    if (!host) return;
    if (!hostElement) {
      // Already empty for every frame of a scrub — don't touch the DOM
      if (host.firstChild) host.replaceChildren();
      return;
    }
    hostElement.className =
      'max-w-full max-h-full object-contain transition-transform duration-200';
    hostElement.style.transform = `scale(${zoom})`;
    if (hostElement instanceof HTMLImageElement) {
      hostElement.alt =
        getNullableString(currentScreenshot?.windowTitle) || 'Screenshot';
    }
    if (host.firstChild !== hostElement) {
      host.replaceChildren(hostElement);
    }
  }, [hostElement, zoom, currentScreenshot]);

  const scrubCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrubContextRef = useRef<CanvasRenderingContext2D | null>(null);
  // Depend on the frame's identity, not on the cache entry object: getCacheEntry
  // returns a fresh literal per call, so depending on it repainted the whole
  // canvas on every unrelated re-render — the exact per-frame cost this exists
  // to avoid.
  const frameUrl =
    cacheEntry?.url ?? (scrubSource instanceof HTMLImageElement ? scrubSource.src : '');
  useEffect(() => {
    const canvas = scrubCanvasRef.current;
    if (!usingCanvas || !canvas || !scrubSource) return;
    if (!sourceWidth || !sourceHeight) return;
    canvas.dataset.frameUrl = frameUrl;

    // translateZ keeps the canvas on its own layer, so a new frame is a
    // texture upload rather than a repaint of the dialog behind it
    const transform = `translateZ(0) scale(${zoom})`;
    if (canvas.style.transform !== transform) canvas.style.transform = transform;

    // Hold the backing store at proxy scale whatever the source is, so
    // alternating between a thumbnail and a full-res frame doesn't reallocate
    // it every paint. A thumbnail is simply drawn up to that size.
    const fit = PROXY_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight);
    const bitmapWidth = Math.round(sourceWidth * fit);
    const bitmapHeight = Math.round(sourceHeight * fit);
    if (
      Math.abs(canvas.width - bitmapWidth) > 2 ||
      Math.abs(canvas.height - bitmapHeight) > 2
    ) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }
    let context = scrubContextRef.current;
    if (!context) {
      try {
        context = canvas.getContext('2d', { alpha: false });
      } catch {
        context = null;
      }
      if (!context) {
        // No canvas here: fall back to swapping cached elements permanently
        setCanvasUsable(false);
        return;
      }
      scrubContextRef.current = context;
    }
    context.drawImage(scrubSource, 0, 0, canvas.width, canvas.height);
    paintedInHoldRef.current = true;
  }, [usingCanvas, scrubSource, sourceWidth, sourceHeight, frameUrl, zoom]);

  // The dialog unmounts its content on close, so the canvas and its 2d context
  // go with it; drop our handles rather than drawing into a detached node
  useEffect(() => {
    if (!open) {
      paintedInHoldRef.current = false;
      scrubContextRef.current = null;
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setZoom(1);
  }, [onOpenChange]);

  const toggleZoom = useCallback(() => {
    setZoom((prev) => (prev === 1 ? 2 : 1));
  }, []);

  // The ±5 thumbnail window is rebuilt whenever the index moves, mounting up
  // to eleven fresh <img> — per painted frame, while scrubbing. It follows the
  // settled index instead and catches up when the scrub stops. Adjusted during
  // render rather than in an effect, so settling doesn't cost a second paint.
  const [stripIndex, setStripIndex] = useState(initialIndex);
  if (!isScrubbing && stripIndex !== currentIndex) setStripIndex(currentIndex);

  // Keyboard navigation
  // Left/Right are handled by the hold-to-scrub listener above
  useKeyboardNav({
    onEscape: handleClose,
    enabled: open,
  });

  if (!currentScreenshot) return null;

  const altText = getNullableString(currentScreenshot.windowTitle) || 'Screenshot';
  // Whatever the canvas and the hosted full-res node don't cover. Scrubbing
  // shows the thumbnail (filling the frame — the 200px strip thumbnail would
  // otherwise sit as a postage stamp mid-viewer); at rest, the settled image.
  const overlay =
    usingCanvas || hostElement ? null : (
      (() => {
        const url = isScrubbing ? scrubPreviewUrl : settledUrl;
        if (!url) return <Skeleton className="w-[80vw] aspect-video" />;
        return isScrubbing ? (
          <img src={url} alt={altText} className="w-full h-full object-contain" />
        ) : (
          <img
            src={url}
            alt={altText}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
        );
      })()
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="image-gallery" className="w-screen h-screen max-w-none max-h-none p-0 bg-black/95 border-0 rounded-none">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="text-white">
            <p className="text-sm font-medium">
              {formatDate(currentScreenshot.timestamp)} {formatTimestamp(currentScreenshot.timestamp)}
            </p>
            <p className="text-xs text-white/70">
              {getNullableString(currentScreenshot.appName) || 'Unknown'} - {getNullableString(currentScreenshot.windowTitle) || 'Screenshot'}
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

        {/* Main Image: the pre-decoded full-res element when available,
            thumbnail while the decoder catches up during fast scrubbing,
            settled-query image or skeleton otherwise */}
        <div className="flex items-center justify-center h-full overflow-auto py-20">
          {/* Sized by the box, not by its bitmap: object-contain letterboxes
              the small proxy to exactly the geometry `max-w-full max-h-full`
              gives the full-res image, so releasing the key resizes nothing */}
          <canvas
            ref={scrubCanvasRef}
            data-testid="scrub-canvas"
            className={usingCanvas ? 'w-full h-full object-contain' : 'hidden'}
          />
          <div
            ref={imageHostRef}
            className={`contents ${hostElement ? "" : "hidden"}`}
            data-testid="fullres-host"
          />
          {overlay}
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
              Math.max(0, stripIndex - 5),
              Math.min(screenshots.length, stripIndex + 6)
            ).map((screenshot, idx) => {
              const actualIndex = Math.max(0, stripIndex - 5) + idx;
              return (
                <div
                  key={screenshot.id}
                  className={`flex-shrink-0 w-16 aspect-video rounded overflow-hidden cursor-pointer transition-all ${
                    actualIndex === currentIndex && !isScrubbing
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
