import { GitBranch } from 'lucide-react';
import type { GitEventDisplay } from '@/types/timeline';
import { TimelineListItem } from './TimelineListItem';

interface GitListItemProps {
  gitEvent: GitEventDisplay;
}

export function GitListItem({ gitEvent }: GitListItemProps) {
  const icon = (
    <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center text-white">
      <GitBranch className="w-3 h-3" />
    </div>
  );

  const details = `${gitEvent.repository} • ${gitEvent.branch} • +${gitEvent.insertions}/-${gitEvent.deletions}`;

  const metadata = (
    <code className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono">
      {gitEvent.shortHash}
    </code>
  );

  return (
    <TimelineListItem
      icon={icon}
      title={gitEvent.messageSubject}
      details={details}
      timestamp={gitEvent.timestamp}
      metadata={metadata}
    />
  );
}
