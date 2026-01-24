import { Link } from 'react-router-dom';
import { Clock, FileCode, GitCommit, Sparkles, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useProjects, useUnassignedEventCount } from '@/api/hooks';

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface AllProjectsViewProps {
  onNewProject: () => void;
}

export function AllProjectsView({ onNewProject }: AllProjectsViewProps) {
  const { data: projects, isLoading } = useProjects();
  const { data: unassignedCount } = useUnassignedEventCount();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">All Projects</h1>
        <p className="text-muted-foreground mt-1">
          Organize activities into projects. Click a project to view details.
        </p>
      </div>

      {/* Unassigned count notice */}
      {unassignedCount != null && unassignedCount > 0 && (
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm">
                You have <strong>{unassignedCount.toLocaleString()}</strong> activities without project assignments.
              </span>
            </div>
            <Link
              to="/settings/projects"
              className="text-sm text-amber-700 dark:text-amber-400 hover:underline font-medium"
            >
              Configure auto-assignment →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Projects grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <ProjectSummaryCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <Card className="py-12 text-center">
          <CardContent>
            <div className="text-muted-foreground mb-4">
              No projects yet. Create your first project to start organizing activities.
            </div>
            <Button onClick={onNewProject}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Lightweight project card that links to detail view
import { useProjectStats, useProjectPatterns } from '@/api/hooks';
import type { Project } from '@/api/client';

function ProjectSummaryCard({ project }: { project: Project }) {
  const { data: stats } = useProjectStats(project.id);
  const { data: patterns } = useProjectPatterns(project.id);

  return (
    <Link to={`/projects/${project.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <CardTitle className="text-lg">{project.name}</CardTitle>
          </div>
          {project.description && (
            <CardDescription className="mt-1 line-clamp-2">{project.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {stats && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatMinutes(stats.totalMinutes)}</span>
              </div>
              <div className="flex items-center gap-1">
                <FileCode className="h-4 w-4" />
                <span>{stats.focusEventCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <GitCommit className="h-4 w-4" />
                <span>{stats.gitCommitCount}</span>
              </div>
              {patterns && patterns.length > 0 && (
                <div className="flex items-center gap-1">
                  <Sparkles className="h-4 w-4" />
                  <span>{patterns.length} rules</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
