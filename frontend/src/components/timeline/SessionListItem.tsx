import { Sparkles } from 'lucide-react';
import type { SessionSummaryWithPosition } from '@/types/timeline';
import { TimelineListItem } from './TimelineListItem';
import { CATEGORY_TEXT_COLORS } from '@/types/timeline';
import { formatDecimalHours } from '@/utils/timelineHelpers';

interface SessionListItemProps {
  session: SessionSummaryWithPosition;
  onClick?: (sessionId: number) => void;
}

export function SessionListItem({ session, onClick }: SessionListItemProps) {
  const duration = session.durationSeconds !== null ? formatDecimalHours(session.durationSeconds / 3600) : 'Ongoing';

  const icon = (
    <div className="w-5 h-5 rounded bg-purple-500 flex items-center justify-center text-white">
      <Sparkles className="w-3 h-3" />
    </div>
  );

  const categoryColor = CATEGORY_TEXT_COLORS[session.category as keyof typeof CATEGORY_TEXT_COLORS] || '';

  const metadata = session.topApps.length > 0 ? (
    <span className={categoryColor}>{session.topApps.slice(0, 2).join(', ')}</span>
  ) : null;

  return (
    <TimelineListItem
      icon={icon}
      title={session.summary || 'Session'}
      details={session.explanation}
      onClick={onClick ? () => onClick(session.id) : undefined}
      duration={duration}
      timestamp={session.startTime}
      metadata={metadata}
    />
  );
}
