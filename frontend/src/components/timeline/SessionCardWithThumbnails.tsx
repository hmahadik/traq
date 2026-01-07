import { SessionCard } from './SessionCard';
import { useScreenshotsForSession } from '@/api/hooks';
import type { SessionSummary } from '@/types';

interface SessionCardWithThumbnailsProps {
  session: SessionSummary;
  isSelected?: boolean;
  onSelect?: () => void;
  onGenerateSummary?: () => void;
  isGeneratingSummary?: boolean;
}

/**
 * Wrapper around SessionCard that fetches real thumbnails from the API
 * instead of using mock data.
 */
export function SessionCardWithThumbnails({
  session,
  isSelected,
  onSelect,
  onGenerateSummary,
  isGeneratingSummary,
}: SessionCardWithThumbnailsProps) {
  // Fetch thumbnails for this session (first 6-8 screenshots)
  const { data: screenshots } = useScreenshotsForSession(
    session.id,
    1, // page
    8  // perPage - fetch a few more than we display (6) to show "+N more"
  );

  return (
    <SessionCard
      session={session}
      thumbnails={screenshots?.screenshots || []}
      isSelected={isSelected}
      onSelect={onSelect}
      onGenerateSummary={onGenerateSummary}
      isGeneratingSummary={isGeneratingSummary}
    />
  );
}
