import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProjects, useBulkAssignProject } from '@/api/hooks';
import { cn } from '@/lib/utils';
import { parseEventKey } from '@/utils/eventKeys';

interface ProjectAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityKeys: string[]; // Event keys in format "type:id"
  onComplete: () => void;
}

// Supported event types for project assignment
const ASSIGNABLE_EVENT_TYPES = ['activity', 'focus'];

export function ProjectAssignDialog({
  open,
  onOpenChange,
  activityKeys,
  onComplete,
}: ProjectAssignDialogProps) {
  const { data: projects } = useProjects();
  const assignMutation = useBulkAssignProject();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  // Filter to only assignable events and count skipped
  const { assignableKeys, skippedCount, skippedTypes } = useMemo(() => {
    const assignable: string[] = [];
    const skippedTypesSet = new Set<string>();
    let skipped = 0;

    for (const key of activityKeys) {
      const { type } = parseEventKey(key);
      if (ASSIGNABLE_EVENT_TYPES.includes(type)) {
        assignable.push(key);
      } else {
        skipped++;
        skippedTypesSet.add(type);
      }
    }

    return {
      assignableKeys: assignable,
      skippedCount: skipped,
      skippedTypes: Array.from(skippedTypesSet),
    };
  }, [activityKeys]);

  const handleAssign = async () => {
    if (!selectedProject || assignableKeys.length === 0) return;

    // Parse event keys to assignments array with validation
    const assignments = assignableKeys
      .map(key => {
        const parts = key.split(':');
        if (parts.length < 2) return null;
        const eventType = parts[0];
        const eventId = parseInt(parts[1], 10);
        if (isNaN(eventId)) return null;
        return {
          eventType,
          eventId,
          projectId: selectedProject,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (assignments.length === 0) return;

    try {
      await assignMutation.mutateAsync(assignments);
      setSelectedProject(null);
      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to assign activities:', error);
    }
  };

  // No assignable items - show error state
  if (assignableKeys.length === 0 && activityKeys.length > 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Assign to Project</DialogTitle>
            <DialogDescription>
              Project assignment is only available for activity events.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 p-3 rounded bg-muted text-sm">
            <p className="text-muted-foreground">
              Selected items ({activityKeys.length}): {skippedTypes.join(', ')} events
            </p>
            <p className="mt-2">
              Only <strong>activity</strong> events can be assigned to projects.
              Try selecting activity blocks in the timeline.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to Project</DialogTitle>
          {skippedCount > 0 && (
            <DialogDescription>
              {skippedCount} {skippedCount === 1 ? 'item' : 'items'} skipped ({skippedTypes.join(', ')}) — only activities can be assigned.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-2 my-4 max-h-64 overflow-y-auto">
          {projects?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No projects found. Create a project first.
            </p>
          )}
          {projects?.map((project) => (
            <button
              key={project.id}
              onClick={() => setSelectedProject(project.id)}
              role="radio"
              aria-checked={selectedProject === project.id}
              className={cn(
                'w-full flex items-center gap-2 p-2 rounded border text-left',
                selectedProject === project.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
              )}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="truncate">{project.name}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedProject || assignMutation.isPending || assignableKeys.length === 0}
          >
            {assignMutation.isPending
              ? 'Assigning...'
              : `Assign ${assignableKeys.length} activit${assignableKeys.length !== 1 ? 'ies' : 'y'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
