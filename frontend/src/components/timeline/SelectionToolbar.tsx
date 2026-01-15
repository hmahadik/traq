/**
 * Selection Toolbar
 *
 * Floating toolbar that appears when activities are selected.
 * Shows selection count and provides bulk actions (delete).
 */

import { useEffect } from 'react';
import { Trash2, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Breakdown of selected event types
export interface SelectionBreakdown {
  activity?: number;
  browser?: number;
  git?: number;
  shell?: number;
  file?: number;
  afk?: number;
}

interface SelectionToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
  onEdit?: () => void; // Only available when exactly 1 activity selected
  isDeleting?: boolean;
  breakdown?: SelectionBreakdown; // Optional breakdown by event type
}

// Format the breakdown into a readable string
function formatBreakdown(breakdown: SelectionBreakdown): string {
  const parts: string[] = [];
  if (breakdown.activity) {
    parts.push(`${breakdown.activity} ${breakdown.activity === 1 ? 'activity' : 'activities'}`);
  }
  if (breakdown.browser) {
    parts.push(`${breakdown.browser} ${breakdown.browser === 1 ? 'page visit' : 'page visits'}`);
  }
  if (breakdown.git) {
    parts.push(`${breakdown.git} ${breakdown.git === 1 ? 'commit' : 'commits'}`);
  }
  if (breakdown.shell) {
    parts.push(`${breakdown.shell} ${breakdown.shell === 1 ? 'command' : 'commands'}`);
  }
  if (breakdown.file) {
    parts.push(`${breakdown.file} ${breakdown.file === 1 ? 'file event' : 'file events'}`);
  }
  if (breakdown.afk) {
    parts.push(`${breakdown.afk} ${breakdown.afk === 1 ? 'AFK period' : 'AFK periods'}`);
  }
  return parts.join(', ');
}

export function SelectionToolbar({
  selectedCount,
  onDelete,
  onClear,
  onEdit,
  isDeleting = false,
  breakdown,
}: SelectionToolbarProps) {
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to clear selection
      if (e.key === 'Escape') {
        onClear();
      }
    };

    if (selectedCount > 0) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedCount, onClear]);

  // Don't render if nothing selected
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-3 bg-background border border-border rounded-lg shadow-lg px-4 py-2">
        <span className="text-sm font-medium text-foreground">
          {breakdown ? formatBreakdown(breakdown) : `${selectedCount} ${selectedCount === 1 ? 'item' : 'items'}`} selected
        </span>

        <div className="h-4 w-px bg-border" />

        {/* Edit button - only enabled for single selection */}
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={selectedCount !== 1}
            className="gap-1.5"
            title={selectedCount === 1 ? 'Edit activity' : 'Select exactly 1 activity to edit'}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Selected Items</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {breakdown ? formatBreakdown(breakdown) : `${selectedCount} ${selectedCount === 1 ? 'item' : 'items'}`}? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
