import { useThumbnail, useScreenshotImage } from '@/api/hooks';
import { cn, formatTimestamp } from '@/lib/utils';
import type { Screenshot as ScreenshotType } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { AppBadge } from './AppBadge';

interface ScreenshotProps {
  screenshot: ScreenshotType;
  size?: 'thumbnail' | 'medium' | 'full';
  showOverlay?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Screenshot({
  screenshot,
  size = 'thumbnail',
  showOverlay = true,
  onClick,
  className,
}: ScreenshotProps) {
  const { data: thumbnailUrl, isLoading: thumbnailLoading } = useThumbnail(screenshot.id);
  const { data: fullUrl, isLoading: fullLoading } = useScreenshotImage(screenshot.id);

  const isLoading = size === 'thumbnail' ? thumbnailLoading : fullLoading;
  const imageUrl = size === 'thumbnail' ? thumbnailUrl : fullUrl;

  const sizeClasses = {
    thumbnail: 'w-[200px]',
    medium: 'w-[400px]',
    full: 'w-full max-w-[1920px]',
  };

  if (isLoading) {
    return (
      <Skeleton
        className={cn('aspect-video rounded', sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'relative aspect-video rounded overflow-hidden bg-muted cursor-pointer group',
        sizeClasses[size],
        onClick && 'hover:ring-2 ring-primary transition-all',
        className
      )}
      onClick={onClick}
    >
      <img
        src={imageUrl}
        alt={screenshot.windowTitle || 'Screenshot'}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {showOverlay && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between">
            <AppBadge appName={screenshot.appName} size="sm" />
            <span className="text-xs text-white/80">
              {formatTimestamp(screenshot.timestamp)}
            </span>
          </div>
          {screenshot.windowTitle && (
            <p className="text-xs text-white/70 truncate mt-1">
              {screenshot.windowTitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Filmstrip variant for horizontal scrolling
interface FilmstripProps {
  screenshots: ScreenshotType[];
  onSelect?: (screenshot: ScreenshotType, index: number) => void;
  selectedIndex?: number;
}

export function Filmstrip({ screenshots, onSelect, selectedIndex }: FilmstripProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {screenshots.map((screenshot, index) => (
        <div
          key={screenshot.id}
          className={cn(
            'flex-shrink-0 rounded overflow-hidden cursor-pointer transition-all',
            selectedIndex === index
              ? 'ring-2 ring-primary scale-105'
              : 'hover:ring-1 ring-primary/50'
          )}
          onClick={() => onSelect?.(screenshot, index)}
        >
          <Screenshot
            screenshot={screenshot}
            size="thumbnail"
            showOverlay={false}
            className="w-[120px]"
          />
        </div>
      ))}
    </div>
  );
}
