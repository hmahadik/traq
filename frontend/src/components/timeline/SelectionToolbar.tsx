/**
 * Selection Toolbar
 *
 * Floating toolbar that appears when activities are selected.
 * Shows selection count and provides bulk actions (delete).
 */

import { useEffect } from 'react';
import { Trash2, X } from 'lucide-react';
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

interface SelectionToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
}

export function SelectionToolbar({
  selectedCount,
  onDelete,
  onClear,
  isDeleting = false,
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
          {selectedCount} {selectedCount === 1 ? 'activity' : 'activities'} selected
        </span>

        <div className="h-4 w-px bg-border" />

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
              <AlertDialogTitle>Delete Activities</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount}{' '}
                {selectedCount === 1 ? 'activity' : 'activities'}? This action
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
