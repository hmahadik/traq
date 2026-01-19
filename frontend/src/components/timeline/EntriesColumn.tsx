import React from 'react';
import { FolderKanban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GRID_CONSTANTS } from '@/types/timeline';
import { EntryBlock } from './EntryBlock';

interface EntryBlockData {
  id: number;
  eventType: string;
  projectId: number;
  projectName: string;
  projectColor: string;
  appName: string;
  windowTitle: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  confidence: number;
  source: string;
}

interface EntriesColumnProps {
  entries: EntryBlockData[];
  hours: number[];
  hourHeight: number;
  onEntryClick?: (entry: EntryBlockData) => void;
  onEntryContextMenu?: (entry: EntryBlockData, e: React.MouseEvent) => void;
}

export const EntriesColumn: React.FC<EntriesColumnProps> = ({
  entries,
  hours,
  hourHeight,
  onEntryClick,
  onEntryContextMenu,
}) => {
  // Calculate total time
  const totalSeconds = entries.reduce((sum, e) => sum + e.durationSeconds, 0);
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <FolderKanban className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-medium text-foreground">Entries</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {formatDuration(totalSeconds)}
          </Badge>
        </div>
      </div>

      {/* Hour grid background */}
      <div className="relative bg-card">
        {hours.map((hour, index) => (
          <div
            key={hour}
            className={`relative border-b border-border ${
              index % 2 === 0 ? 'bg-card' : 'bg-muted/30'
            }`}
            style={{ height: `${hourHeight}px` }}
          />
        ))}

        {/* Entry blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-2">
              <FolderKanban className="w-6 h-6 mb-2 opacity-30" />
              <span className="text-[10px] text-center">
                Assign activities to projects to see them here
              </span>
            </div>
          ) : (
            entries.map((entry) => (
              <EntryBlock
                key={`${entry.eventType}-${entry.id}`}
                entry={entry}
                hourHeight={hourHeight}
                onClick={onEntryClick}
                onContextMenu={onEntryContextMenu}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
