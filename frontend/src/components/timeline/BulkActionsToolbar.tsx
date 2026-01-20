import { Button } from '@/components/ui/button';
import {
  FolderPlus,
  Merge,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import type { EventKey } from '@/utils/eventKeys';

interface BulkActionsToolbarProps {
  selectedKeys: Set<EventKey>; // From parent, not context
  onClear: () => void; // From parent
  onAssignProject: (keys: EventKey[]) => void;
  onMerge: (keys: EventKey[]) => void;
  onDelete: (keys: EventKey[]) => void;
  onAcceptDrafts: (keys: EventKey[]) => void;
}

export function BulkActionsToolbar({
  selectedKeys,
  onClear,
  onAssignProject,
  onMerge,
  onDelete,
  onAcceptDrafts,
}: BulkActionsToolbarProps) {
  if (selectedKeys.size === 0) return null;

  const keys = Array.from(selectedKeys);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 px-4 py-2 bg-background border rounded-lg shadow-lg">
        <span className="text-sm text-muted-foreground mr-2">
          {selectedKeys.size} selected
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onAssignProject(keys)}
        >
          <FolderPlus className="h-4 w-4 mr-1" />
          Assign Project
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onMerge(keys)}
          disabled={selectedKeys.size < 2}
        >
          <Merge className="h-4 w-4 mr-1" />
          Merge
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onAcceptDrafts(keys)}
        >
          <Check className="h-4 w-4 mr-1" />
          Accept Drafts
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(keys)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
