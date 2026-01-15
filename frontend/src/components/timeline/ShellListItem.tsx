import { Terminal } from 'lucide-react';
import type { ShellEventDisplay } from '@/types/timeline';
import { TimelineListItem } from './TimelineListItem';
import { formatDecimalHours } from '@/utils/timelineHelpers';

interface ShellListItemProps {
  shellEvent: ShellEventDisplay;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function ShellListItem({ shellEvent, isSelected, onClick }: ShellListItemProps) {
  const icon = (
    <div className="w-5 h-5 rounded bg-slate-700 dark:bg-slate-400 flex items-center justify-center text-white dark:text-slate-900">
      <Terminal className="w-3 h-3" />
    </div>
  );

  const duration = shellEvent.durationSeconds > 0 ? formatDecimalHours(shellEvent.durationSeconds / 3600) : undefined;

  const metadata = (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
      shellEvent.exitCode === 0
        ? 'bg-green-500/20 text-green-700 dark:text-green-400'
        : 'bg-red-500/20 text-red-700 dark:text-red-400'
    }`}>
      Exit {shellEvent.exitCode}
    </span>
  );

  return (
    <TimelineListItem
      icon={icon}
      title={shellEvent.command}
      details={shellEvent.workingDirectory}
      duration={duration}
      timestamp={shellEvent.timestamp}
      metadata={metadata}
      isSelected={isSelected}
      onClick={onClick}
      selectable={Boolean(onClick)}
      reserveCheckboxSpace
    />
  );
}
