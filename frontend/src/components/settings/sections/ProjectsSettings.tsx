import { useState, useMemo } from 'react';
import { Loader2, Play, Eye, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { ProjectRuleDialog } from './ProjectRuleDialog';
import {
  useReportIncludeUnassigned,
  useSetReportIncludeUnassigned,
  useProjectsAutoAssign,
  useSetProjectsAutoAssign,
  useBackfillPreview,
  useBackfillRun,
  useProjects,
  useProjectPatterns,
  useDeleteProjectPattern,
  useMigrateHardcodedPatterns,
} from '@/api/hooks';

interface BackfillResult {
  totalProcessed: number;
  autoAssigned: number;
  alreadyAssigned: number;
  noMatch: number;
}

// Helper to format pattern type for display
const PATTERN_TYPE_LABELS: Record<string, string> = {
  window_title: 'Window Title',
  app_name: 'App Name',
  git_repo: 'Git Repo',
  domain: 'Domain',
  path: 'Path',
};

const MATCH_TYPE_LABELS: Record<string, string> = {
  contains: 'contains',
  exact: 'equals',
  prefix: 'starts with',
  suffix: 'ends with',
  regex: 'matches regex',
};

interface EditingRule {
  id: number;
  projectId: number;
  patternType: string;
  patternValue: string;
  matchType: string;
  weight: number;
}

export function ProjectsSettings() {
  const { data: includeUnassigned = true } = useReportIncludeUnassigned();
  const setIncludeUnassigned = useSetReportIncludeUnassigned();

  const { data: autoAssign = false } = useProjectsAutoAssign();
  const setAutoAssign = useSetProjectsAutoAssign();

  const backfillPreview = useBackfillPreview();
  const backfillRun = useBackfillRun();

  // Projects and patterns for rules UI
  const { data: projects } = useProjects();
  const deletePattern = useDeleteProjectPattern();
  const migratePatterns = useMigrateHardcodedPatterns();

  // Load patterns for all projects
  const projectPatternQueries = useMemo(() => {
    return projects?.map(p => ({ id: p.id, name: p.name, color: p.color })) || [];
  }, [projects]);

  // Dialog state
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EditingRule | null>(null);

  // Date range for backfill (default to last 7 days)
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [minConfidence, setMinConfidence] = useState(0.7);
  const [previewResult, setPreviewResult] = useState<BackfillResult | null>(null);

  const handlePreview = async () => {
    try {
      const result = await backfillPreview.mutateAsync({
        startDate,
        endDate,
        minConfidence,
      });
      setPreviewResult(result as BackfillResult);
    } catch (error) {
      toast.error('Preview failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleRun = async () => {
    try {
      const result = await backfillRun.mutateAsync({
        startDate,
        endDate,
        minConfidence,
      });
      const assigned = (result as BackfillResult)?.autoAssigned ?? 0;
      toast.success('Backfill complete', {
        description: `Assigned ${assigned} activities to projects`,
      });
      setPreviewResult(null);
    } catch (error) {
      toast.error('Backfill failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleAddRule = () => {
    setEditingRule(null);
    setRuleDialogOpen(true);
  };

  const handleEditRule = (rule: EditingRule) => {
    setEditingRule(rule);
    setRuleDialogOpen(true);
  };

  const handleDeleteRule = async (patternId: number) => {
    if (!confirm('Delete this rule? Events already assigned will keep their assignment.')) {
      return;
    }
    try {
      await deletePattern.mutateAsync(patternId);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Auto-Assignment */}
      <SettingsCard
        title="Auto-Assignment"
        description="Automatically assign activities to projects as they are tracked"
      >
        <SettingsRow
          label="Auto-assign new activities"
          description="When enabled, new activities will be automatically assigned to matching projects"
        >
          <Switch
            checked={autoAssign}
            onCheckedChange={(checked) => setAutoAssign.mutate(checked)}
            disabled={setAutoAssign.isPending}
          />
        </SettingsRow>
      </SettingsCard>

      {/* Report Config */}
      <SettingsCard
        title="Report Settings"
        description="Configure how activities appear in generated reports"
      >
        <SettingsRow
          label="Include unassigned activities"
          description="When disabled, only project-assigned activities appear in reports"
        >
          <Switch
            checked={includeUnassigned}
            onCheckedChange={(checked) => setIncludeUnassigned.mutate(checked)}
            disabled={setIncludeUnassigned.isPending}
          />
        </SettingsRow>
      </SettingsCard>

      {/* Project Matching Rules */}
      <SettingsCard
        title="Project Matching Rules"
        description="Define patterns to automatically assign activities to projects"
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => migratePatterns.mutate()}
              disabled={migratePatterns.isPending}
            >
              {migratePatterns.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Import Defaults
            </Button>
            <Button size="sm" onClick={handleAddRule}>
              <Plus className="h-4 w-4 mr-1" />
              Add Rule
            </Button>
          </div>
        }
      >
        {projectPatternQueries.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No projects found. Create a project first.
          </div>
        ) : (
          <div className="space-y-4">
            {projectPatternQueries.map((project) => (
              <ProjectRulesSection
                key={project.id}
                projectId={project.id}
                projectName={project.name}
                projectColor={project.color}
                onEdit={handleEditRule}
                onDelete={handleDeleteRule}
              />
            ))}
          </div>
        )}
      </SettingsCard>

      {/* Rule Dialog */}
      <ProjectRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        editRule={editingRule}
      />

      {/* Backfill */}
      <SettingsCard
        title="Backfill Projects"
        description="Apply project patterns to historical activities that haven't been assigned yet"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="start-date" className="text-sm font-medium">
              Start Date
            </label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="end-date" className="text-sm font-medium">
              End Date
            </label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="min-confidence" className="text-sm font-medium">
            Minimum Confidence: {Math.round(minConfidence * 100)}%
          </label>
          <Input
            id="min-confidence"
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {previewResult && (
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="font-medium">Preview Results:</div>
            <div>Total activities: {previewResult.totalProcessed}</div>
            <div className="text-green-600 dark:text-green-400">
              Would assign: {previewResult.autoAssigned}
            </div>
            <div className="text-muted-foreground">
              Already assigned: {previewResult.alreadyAssigned}
            </div>
            <div className="text-muted-foreground">
              No pattern match: {previewResult.noMatch}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={backfillPreview.isPending}
          >
            {backfillPreview.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Preview
          </Button>
          <Button
            onClick={handleRun}
            disabled={backfillRun.isPending || !previewResult || previewResult.autoAssigned === 0}
          >
            {backfillRun.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Backfill
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}

// Sub-component to display rules for a single project
interface ProjectRulesSectionProps {
  projectId: number;
  projectName: string;
  projectColor: string;
  onEdit: (rule: EditingRule) => void;
  onDelete: (patternId: number) => void;
}

function ProjectRulesSection({
  projectId,
  projectName,
  projectColor,
  onEdit,
  onDelete,
}: ProjectRulesSectionProps) {
  const { data: patterns, isLoading } = useProjectPatterns(projectId);

  // Don't show projects without patterns
  if (!isLoading && (!patterns || patterns.length === 0)) {
    return null;
  }

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 font-medium">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: projectColor }}
        />
        {projectName}
        {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      {patterns && patterns.length > 0 && (
        <div className="space-y-1.5 pl-5">
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              className="flex items-center justify-between text-sm group"
            >
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground">
                  {PATTERN_TYPE_LABELS[pattern.patternType] || pattern.patternType}
                </span>{' '}
                <span className="text-muted-foreground">
                  {MATCH_TYPE_LABELS[pattern.matchType] || pattern.matchType}
                </span>{' '}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  {pattern.patternValue}
                </code>
                {pattern.hitCount > 0 && (
                  <span className="text-muted-foreground text-xs ml-2">
                    ({pattern.hitCount} hits)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onEdit({
                    id: pattern.id,
                    projectId,
                    patternType: pattern.patternType,
                    patternValue: pattern.patternValue,
                    matchType: pattern.matchType,
                    weight: pattern.weight,
                  })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => onDelete(pattern.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
