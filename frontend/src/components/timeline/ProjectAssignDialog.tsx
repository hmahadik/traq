import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProjects, useBulkAssignProject } from '@/api/hooks';
import { cn } from '@/lib/utils';

interface ProjectAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityKeys: string[]; // Event keys in format "type:id"
  onComplete: () => void;
}

export function ProjectAssignDialog({
  open,
  onOpenChange,
  activityKeys,
  onComplete,
}: ProjectAssignDialogProps) {
  const { data: projects } = useProjects();
  const assignMutation = useBulkAssignProject();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  const handleAssign = async () => {
    if (!selectedProject || activityKeys.length === 0) return;

    // Parse event keys to assignments array with validation
    const assignments = activityKeys
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to Project</DialogTitle>
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
            disabled={!selectedProject || assignMutation.isPending}
          >
            {assignMutation.isPending
              ? 'Assigning...'
              : `Assign ${activityKeys.length} item${activityKeys.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
