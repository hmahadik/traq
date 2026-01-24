import { useMemo } from 'react';
import { Plus, Loader2, CheckSquare, Square, CircleOff } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjects, useUnassignedEventCount } from '@/api/hooks';
import { api } from '@/api/client';

// Special ID for unassigned activities
export const UNASSIGNED_PROJECT_ID = 0;

interface ProjectsSidebarProps {
  selectedProjectIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  onNewProject: () => void;
  onEditProject: (id: number) => void;
}

export function ProjectsSidebar({
  selectedProjectIds,
  onSelectionChange,
  onNewProject,
  onEditProject,
}: ProjectsSidebarProps) {
  const { data: projects, isLoading } = useProjects();
  const { data: unassignedCount } = useUnassignedEventCount();

  // Fetch stats for all projects
  const statsQueries = useQueries({
    queries: (projects || []).map((project) => ({
      queryKey: ['project', project.id, 'stats'],
      queryFn: () => api.projects.getStats(project.id),
      staleTime: 60000, // 1 minute
    })),
  });

  // Build a map of projectId -> eventCount
  const projectEventCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    if (projects) {
      projects.forEach((project, idx) => {
        const stats = statsQueries[idx]?.data;
        if (stats) {
          // Sum of focus events and screenshots gives a good "activity" count
          counts[project.id] = stats.focusEventCount + stats.screenshotCount;
        }
      });
    }
    return counts;
  }, [projects, statsQueries]);

  const toggleProject = (id: number) => {
    const next = new Set(selectedProjectIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const selectAll = () => {
    if (!projects) return;
    onSelectionChange(new Set(projects.map((p) => p.id)));
  };

  const selectNone = () => {
    onSelectionChange(new Set());
  };

  const allSelected = projects && projects.length > 0 && selectedProjectIds.size === projects.length;
  const someSelected = selectedProjectIds.size > 0 && !allSelected;

  return (
    <aside className="h-full border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h1 className="text-lg font-semibold">Projects</h1>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onNewProject}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Select All / None */}
      {projects && projects.length > 0 && (
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <button
            onClick={allSelected ? selectNone : selectAll}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {allSelected ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          {someSelected && (
            <span className="text-xs text-muted-foreground">
              {selectedProjectIds.size} selected
            </span>
          )}
        </div>
      )}

      <nav className="flex-1 p-2 overflow-y-auto">
        {/* Unassigned option */}
        {unassignedCount != null && unassignedCount > 0 && (
          <>
            <div
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                selectedProjectIds.has(UNASSIGNED_PROJECT_ID)
                  ? 'text-foreground'
                  : 'text-muted-foreground/60 hover:text-muted-foreground'
              )}
              onClick={() => toggleProject(UNASSIGNED_PROJECT_ID)}
            >
              <Checkbox
                checked={selectedProjectIds.has(UNASSIGNED_PROJECT_ID)}
                onCheckedChange={() => toggleProject(UNASSIGNED_PROJECT_ID)}
                onClick={(e) => e.stopPropagation()}
                className="h-3.5 w-3.5"
              />
              <CircleOff className="w-3 h-3 shrink-0 text-amber-500" />
              <span className="truncate flex-1">Unassigned</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-medium">
                {unassignedCount.toLocaleString()}
              </span>
            </div>
            <div className="border-t my-2" />
          </>
        )}

        {/* Project List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : projects && projects.length > 0 ? (
          <ul className="space-y-0.5">
            {projects.map((project) => {
              const isSelected = selectedProjectIds.has(project.id);
              const eventCount = projectEventCounts[project.id];
              return (
                <li key={project.id}>
                  <div
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer group',
                      isSelected
                        ? 'text-foreground'
                        : 'text-muted-foreground/60 hover:text-muted-foreground'
                    )}
                    onClick={() => toggleProject(project.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleProject(project.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5"
                    />
                    <span
                      className={cn(
                        'w-2.5 h-2.5 rounded-full shrink-0 transition-opacity',
                        !isSelected && 'opacity-50'
                      )}
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate flex-1">{project.name}</span>
                    {eventCount != null && eventCount > 0 && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          isSelected
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {eventCount.toLocaleString()}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-4">
            No projects yet
          </div>
        )}
      </nav>
    </aside>
  );
}
