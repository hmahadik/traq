import { HourGroup } from './HourGroup';
import { useScreenshotsForHour } from '@/api/hooks';
import type { Screenshot } from '@/types';

interface HourGroupWithScreenshotsProps {
  date: string; // ISO date string (YYYY-MM-DD)
  hour: number; // 0-23
  onScreenshotClick?: (screenshot: Screenshot, index: number) => void;
  defaultExpanded?: boolean;
}

/**
 * Wrapper around HourGroup that fetches real screenshots from the API
 * for a specific hour instead of using mock data.
 */
export function HourGroupWithScreenshots({
  date,
  hour,
  onScreenshotClick,
  defaultExpanded,
}: HourGroupWithScreenshotsProps) {
  // Fetch screenshots for this specific hour
  const { data: screenshots, isLoading } = useScreenshotsForHour(date, hour);

  return (
    <HourGroup
      hour={hour}
      screenshots={screenshots || []}
      isLoading={isLoading}
      onScreenshotClick={onScreenshotClick}
      defaultExpanded={defaultExpanded}
    />
  );
}
