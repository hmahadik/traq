import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ResizableHandle } from '@/components/ui/resizable';
import { ProjectsSidebar } from '@/components/projects/ProjectsSidebar';
import { ProjectsUnifiedView } from '@/components/projects/ProjectsUnifiedView';
import { useCreateProject, useUpdateProject, useProject, useProjects } from '@/api/hooks';

// Default color palette for new projects
const COLOR_PALETTE = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

interface ProjectFormData {
  name: string;
  color: string;
  description: string;
}

function ProjectFormDialog({
  open,
  onOpenChange,
  editProjectId,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProjectId?: number | null;
  onSave: (data: ProjectFormData) => void;
  isSaving: boolean;
}) {
  const { data: project } = useProject(editProjectId || 0);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    color: COLOR_PALETTE[0],
    description: '',
  });

  // Reset form data when dialog opens or project changes
  useEffect(() => {
    if (open) {
      if (project && editProjectId) {
        setFormData({
          name: project.name,
          color: project.color,
          description: project.description || '',
        });
      } else {
        setFormData({
          name: '',
          color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
          description: '',
        });
      }
    }
  }, [open, project, editProjectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  const isEditing = !!editProjectId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Project' : 'Create Project'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the project details below.'
                : 'Create a new project to organize your activities.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Project name"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (optional)
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this project about?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name.trim() || isSaving}>
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsPage() {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { data: projects } = useProjects();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(220); // pixels
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-select all projects on first load
  useEffect(() => {
    if (projects && projects.length > 0 && selectedProjectIds.size === 0) {
      setSelectedProjectIds(new Set(projects.map((p) => p.id)));
    }
  }, [projects]);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((prev) => {
      const newWidth = prev + delta;
      // Clamp between 150px and 400px
      return Math.max(150, Math.min(400, newWidth));
    });
  }, []);

  const handleNewProject = () => {
    setEditingProjectId(null);
    setFormOpen(true);
  };

  const handleEditProject = (projectId: number) => {
    setEditingProjectId(projectId);
    setFormOpen(true);
  };

  const handleSave = (data: ProjectFormData) => {
    if (editingProjectId) {
      updateProject.mutate(
        { id: editingProjectId, ...data },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditingProjectId(null);
          },
        }
      );
    } else {
      createProject.mutate(data, {
        onSuccess: (newProject) => {
          setFormOpen(false);
          // Add new project to selection
          if (newProject?.id) {
            setSelectedProjectIds((prev) => new Set([...prev, newProject.id]));
          }
        },
      });
    }
  };

  return (
    <div ref={containerRef} className="h-full overflow-hidden -mx-4 sm:-mx-6 -my-6">
      <div className="flex h-full">
        <div style={{ width: sidebarWidth, flexShrink: 0 }}>
          <ProjectsSidebar
            selectedProjectIds={selectedProjectIds}
            onSelectionChange={setSelectedProjectIds}
            onNewProject={handleNewProject}
            onEditProject={handleEditProject}
          />
        </div>
        <ResizableHandle onResize={handleSidebarResize} />
        <div className="flex-1 min-w-0">
          <div className="h-full flex flex-col min-h-0 p-6">
            <ProjectsUnifiedView
              selectedProjectIds={selectedProjectIds}
              onNewProject={handleNewProject}
            />
          </div>
        </div>
      </div>

      {/* Create/Edit dialog */}
      <ProjectFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingProjectId(null);
        }}
        editProjectId={editingProjectId}
        onSave={handleSave}
        isSaving={createProject.isPending || updateProject.isPending}
      />
    </div>
  );
}

export default ProjectsPage;
