import { Moon, Clock, User } from 'lucide-react';
import type { AFKBlock } from '@/types/timeline';
import { TimelineListItem } from './TimelineListItem';
import { formatDecimalHours } from '@/utils/timelineHelpers';

interface AFKListItemProps {
  afkBlock: AFKBlock;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

function getTriggerLabel(triggerType: string) {
  switch (triggerType.toLowerCase()) {
    case 'idle_timeout':
      return 'Idle timeout';
    case 'system_sleep':
      return 'System sleep';
    case 'manual':
      return 'Manual break';
    default:
      return triggerType;
  }
}

function getTriggerIcon(triggerType: string) {
  switch (triggerType.toLowerCase()) {
    case 'system_sleep':
      return <Moon className="w-3 h-3" />;
    case 'manual':
      return <User className="w-3 h-3" />;
    default:
      return <Clock className="w-3 h-3" />;
  }
}

export function AFKListItem({ afkBlock, isSelected, onClick }: AFKListItemProps) {
  const duration = formatDecimalHours(afkBlock.durationSeconds / 3600);
  const triggerLabel = getTriggerLabel(afkBlock.triggerType);

  const icon = (
    <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center text-white">
      {getTriggerIcon(afkBlock.triggerType)}
    </div>
  );

  return (
    <TimelineListItem
      icon={icon}
      title="Away from keyboard"
      details={triggerLabel}
      duration={duration}
      timestamp={afkBlock.startTime}
      isSelected={isSelected}
      onClick={onClick}
      selectable={Boolean(onClick)}
      reserveCheckboxSpace
    />
  );
}
