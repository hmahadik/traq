import { useThumbnail, useScreenshotImage } from '@/api/hooks';
import { cn, formatTimestamp } from '@/lib/utils';
import type { Screenshot as ScreenshotType } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AppBadge } from './AppBadge';
import { Trash2 } from 'lucide-react';

interface ScreenshotProps {
  screenshot: ScreenshotType;
  size?: 'thumbnail' | 'medium' | 'full';
  showOverlay?: boolean;
  onClick?: () => void;
  onDelete?: (id: number) => void;
  isDeleting?: boolean;
  className?: string;
}

export function Screenshot({
  screenshot,
  size = 'thumbnail',
  showOverlay = true,
  onClick,
  onDelete,
  isDeleting = false,
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

  // Use actual monitor dimensions for aspect ratio, fallback to 16:9
  const aspectRatio = screenshot.monitorWidth && screenshot.monitorHeight
    ? screenshot.monitorWidth / screenshot.monitorHeight
    : 16 / 9;

  if (isLoading) {
    return (
      <Skeleton
        className={cn('rounded', sizeClasses[size], className)}
        style={{ aspectRatio }}
      />
    );
  }

  return (
    <div
      className={cn(
        'relative rounded overflow-hidden bg-muted cursor-pointer group',
        sizeClasses[size],
        onClick && 'hover:ring-2 ring-primary transition-all',
        className
      )}
      style={{ aspectRatio }}
      onClick={onClick}
    >
      <img
        src={imageUrl}
        alt={typeof screenshot.windowTitle === 'object' ? (screenshot.windowTitle?.String || 'Screenshot') : (screenshot.windowTitle || 'Screenshot')}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {showOverlay && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between">
            <AppBadge appName={typeof screenshot.appName === 'object' ? screenshot.appName?.String : screenshot.appName} size="sm" />
            <span className="text-xs text-white/80">
              {formatTimestamp(screenshot.timestamp)}
            </span>
          </div>
          {(typeof screenshot.windowTitle === 'object' ? screenshot.windowTitle?.Valid : screenshot.windowTitle) && (
            <p className="text-xs text-white/70 truncate mt-1">
              {typeof screenshot.windowTitle === 'object' ? screenshot.windowTitle?.String : screenshot.windowTitle}
            </p>
          )}
        </div>
      )}
      {onDelete && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(screenshot.id);
          }}
          disabled={isDeleting}
        >
          <Trash2 className={cn("h-3 w-3", isDeleting && "animate-spin")} />
        </Button>
      )}
    </div>
  );
}
