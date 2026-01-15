import type { ActivityBlock } from '@/types/timeline';
import { TimelineListItem } from './TimelineListItem';
import { getAppColors, CATEGORY_TEXT_COLORS, CATEGORY_LABELS } from '@/types/timeline';
import { formatDecimalHours } from '@/utils/timelineHelpers';

interface ActivityListItemProps {
  activity: ActivityBlock;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
}

export function ActivityListItem({
  activity,
  isSelected,
  onClick,
  onDoubleClick,
}: ActivityListItemProps) {
  const colors = getAppColors(activity.appName);
  const duration = formatDecimalHours(activity.durationSeconds / 3600);

  // Get first two letters of app name for icon
  const appInitials = activity.appName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const icon = (
    <div className={`w-5 h-5 rounded ${colors.icon} flex items-center justify-center text-white text-[9px] font-bold`}>
      {appInitials}
    </div>
  );

  const categoryLabel = CATEGORY_LABELS[activity.category as keyof typeof CATEGORY_LABELS] || activity.category;
  const categoryColor = CATEGORY_TEXT_COLORS[activity.category as keyof typeof CATEGORY_TEXT_COLORS] || '';

  const metadata = (
    <span className={categoryColor}>{categoryLabel}</span>
  );

  return (
    <TimelineListItem
      icon={icon}
      title={activity.appName}
      details={activity.windowTitle}
      duration={duration}
      timestamp={activity.startTime}
      metadata={metadata}
      isSelected={isSelected}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      dataActivityId={activity.id}
    />
  );
}
