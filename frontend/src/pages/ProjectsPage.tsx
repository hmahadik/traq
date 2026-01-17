import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Clock, FileCode, GitCommit, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  useProjects,
  useProjectStats,
  useProjectPatterns,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useDeleteProjectPattern,
  useUnassignedEventCount,
} from '@/api/hooks';
import type { Project, ProjectPattern, ProjectStats } from '@/api/client';

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

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function PatternTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    app_name: 'App',
    window_title: 'Window',
    git_repo: 'Git Repo',
    domain: 'Domain',
    path: 'Path',
  };
  return <span className="text-xs text-muted-foreground">{labels[type] || type}</span>;
}

interface ProjectFormData {
  name: string;
  color: string;
  description: string;
}

function ProjectCard({
  project,
  stats,
  patterns,
  onEdit,
  onDelete,
  onDeletePattern,
}: {
  project: Project;
  stats?: ProjectStats | null;
  patterns?: ProjectPattern[];
  onEdit: () => void;
  onDelete: () => void;
  onDeletePattern: (patternId: number) => void;
}) {
  const [showPatterns, setShowPatterns] = useState(false);

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <CardTitle className="text-lg">{project.name}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {project.description && (
          <CardDescription className="mt-1">{project.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats */}
        {stats && (
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatMinutes(stats.totalMinutes)}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <FileCode className="h-4 w-4" />
              <span>{stats.focusEventCount} events</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <GitCommit className="h-4 w-4" />
              <span>{stats.gitCommitCount} commits</span>
            </div>
          </div>
        )}

        {/* Patterns */}
        {patterns && patterns.length > 0 && (
          <div>
            <button
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setShowPatterns(!showPatterns)}
            >
              <Sparkles className="h-4 w-4" />
              {patterns.length} learned patterns
              {showPatterns ? ' (hide)' : ' (show)'}
            </button>
            {showPatterns && (
              <div className="mt-2 flex flex-wrap gap-1">
                {patterns.map((p) => (
                  <Badge
                    key={p.id}
                    variant="secondary"
                    className="text-xs flex items-center gap-1 pr-1"
                  >
                    <PatternTypeLabel type={p.patternType} />
                    <span className="font-mono">{p.patternValue}</span>
                    <button
                      className="ml-1 hover:text-destructive"
                      onClick={() => onDeletePattern(p.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onSave: (data: ProjectFormData) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    color: COLOR_PALETTE[0],
    description: '',
  });

  // Reset form data when dialog opens or project changes
  useEffect(() => {
    if (open) {
      setFormData({
        name: project?.name || '',
        color: project?.color || COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
        description: project?.description || '',
      });
    }
  }, [open, project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{project ? 'Edit Project' : 'Create Project'}</DialogTitle>
            <DialogDescription>
              {project
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
              {isSaving ? 'Saving...' : project ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { data: unassignedCount } = useUnassignedEventCount();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const deletePattern = useDeleteProjectPattern();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const handleCreate = (data: ProjectFormData) => {
    createProject.mutate(data, {
      onSuccess: () => setFormOpen(false),
    });
  };

  const handleUpdate = (data: ProjectFormData) => {
    if (!editingProject) return;
    updateProject.mutate(
      { id: editingProject.id, ...data },
      {
        onSuccess: () => {
          setEditingProject(null);
          setFormOpen(false);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deletingProject) return;
    deleteProject.mutate(deletingProject.id, {
      onSuccess: () => setDeletingProject(null),
    });
  };

  const handleDeletePattern = (patternId: number) => {
    deletePattern.mutate(patternId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Organize activities into projects. Traq learns from your assignments to auto-suggest.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Unassigned count notice */}
      {unassignedCount != null && unassignedCount > 0 && (
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardContent className="flex items-center gap-3 py-3">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span className="text-sm">
              You have <strong>{unassignedCount.toLocaleString()}</strong> activities without project
              assignments. Assign them to help Traq learn your patterns.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Projects grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCardWithData
              key={project.id}
              project={project}
              onEdit={() => {
                setEditingProject(project);
                setFormOpen(true);
              }}
              onDelete={() => setDeletingProject(project)}
              onDeletePattern={handleDeletePattern}
            />
          ))}
        </div>
      ) : (
        <Card className="py-12 text-center">
          <CardContent>
            <div className="text-muted-foreground mb-4">
              No projects yet. Create your first project to start organizing activities.
            </div>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Project
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit dialog */}
      <ProjectFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingProject(null);
        }}
        project={editingProject}
        onSave={editingProject ? handleUpdate : handleCreate}
        isSaving={createProject.isPending || updateProject.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingProject?.name}"? This will remove all learned
              patterns and clear project assignments from events. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Wrapper component to fetch stats and patterns for each project
function ProjectCardWithData({
  project,
  onEdit,
  onDelete,
  onDeletePattern,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onDeletePattern: (patternId: number) => void;
}) {
  const { data: stats } = useProjectStats(project.id);
  const { data: patterns } = useProjectPatterns(project.id);

  return (
    <ProjectCard
      project={project}
      stats={stats}
      patterns={patterns}
      onEdit={onEdit}
      onDelete={onDelete}
      onDeletePattern={onDeletePattern}
    />
  );
}

export default ProjectsPage;
