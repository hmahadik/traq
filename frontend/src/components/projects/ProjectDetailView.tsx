import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Pencil,
  Trash2,
  Clock,
  FileCode,
  GitCommit,
  Sparkles,
  Plus,
  Loader2,
  CheckSquare,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  useProject,
  useProjectStats,
  useProjectPatterns,
  useDeleteProject,
  useDeleteProjectPattern,
  useApplyRuleToHistory,
} from '@/api/hooks';
import { ProjectActivitiesTab } from './ProjectActivitiesTab';
import { ProjectRuleDialog } from '@/components/settings/sections/ProjectRuleDialog';

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

const PATTERN_TYPE_LABELS: Record<string, string> = {
  app_name: 'App Name',
  window_title: 'Window Title',
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

interface ProjectDetailViewProps {
  onEdit: (projectId: number) => void;
}

export function ProjectDetailView({ onEdit }: ProjectDetailViewProps) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const id = projectId ? parseInt(projectId, 10) : 0;

  const { data: project, isLoading } = useProject(id);
  const { data: stats } = useProjectStats(id);
  const { data: patterns } = useProjectPatterns(id);
  const deleteProject = useDeleteProject();
  const deletePattern = useDeleteProjectPattern();
  const applyToHistory = useApplyRuleToHistory();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<{
    id: number;
    projectId: number;
    patternType: string;
    patternValue: string;
    matchType: string;
    weight: number;
  } | null>(null);

  // Pre-filled values for creating rule from activities
  const [prefillPatternType, setPrefillPatternType] = useState<string>('');
  const [prefillPatternValue, setPrefillPatternValue] = useState<string>('');

  // Multi-select state for rules
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Tab navigation and cross-linking state
  const [activeTab, setActiveTab] = useState('activities');
  const [filterByRuleId, setFilterByRuleId] = useState<number | null>(null);
  const [highlightedRuleId, setHighlightedRuleId] = useState<number | null>(null);
  const ruleRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Scroll to and highlight the rule when switching to rules tab
  useEffect(() => {
    if (activeTab === 'rules' && highlightedRuleId !== null) {
      const ruleEl = ruleRefs.current.get(highlightedRuleId);
      if (ruleEl) {
        ruleEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash animation
        ruleEl.classList.add('ring-2', 'ring-primary');
        setTimeout(() => {
          ruleEl.classList.remove('ring-2', 'ring-primary');
          setHighlightedRuleId(null);
        }, 2000);
      }
    }
  }, [activeTab, highlightedRuleId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Project not found
      </div>
    );
  }

  const handleDelete = async () => {
    await deleteProject.mutateAsync(id);
    navigate('/projects');
  };

  const handleDeletePattern = (patternId: number) => {
    if (confirm('Delete this pattern? Events already assigned will keep their assignment.')) {
      deletePattern.mutate(patternId);
    }
  };

  const handleApplyPattern = (patternId: number) => {
    applyToHistory.mutate(patternId);
  };

  // Create rule from activities tab
  const handleCreateRuleFromActivities = (patternType: string, patternValue: string) => {
    setEditingRule(null);
    setPrefillPatternType(patternType);
    setPrefillPatternValue(patternValue);
    setRuleDialogOpen(true);
  };

  // Multi-select handlers for rules
  const toggleRuleSelect = (ruleId: number) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const selectAllRules = () => {
    if (!patterns) return;
    setSelectedRuleIds(new Set(patterns.map((p) => p.id)));
  };

  const clearRuleSelection = () => {
    setSelectedRuleIds(new Set());
  };

  const handleBulkApply = async () => {
    setIsApplyingBulk(true);
    try {
      for (const ruleId of selectedRuleIds) {
        await applyToHistory.mutateAsync(ruleId);
      }
      clearRuleSelection();
    } finally {
      setIsApplyingBulk(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsDeletingBulk(true);
    try {
      for (const ruleId of selectedRuleIds) {
        await deletePattern.mutateAsync(ruleId);
      }
      clearRuleSelection();
      setBulkDeleteDialogOpen(false);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const hasRuleSelection = selectedRuleIds.size > 0;

  // Navigate from rule to activities filtered by that rule
  const handleViewRuleMatches = (ruleId: number) => {
    setFilterByRuleId(ruleId);
    setActiveTab('activities');
  };

  // Navigate from activity to its matching rule
  const handleGoToRule = (ruleId: number) => {
    setHighlightedRuleId(ruleId);
    setActiveTab('rules');
  };

  // Clear filter when switching away from activities tab
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab !== 'activities') {
      setFilterByRuleId(null);
    }
    if (tab !== 'rules') {
      setHighlightedRuleId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-6 h-6 rounded-full shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(id)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Total Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMinutes(stats.totalMinutes)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.focusEventCount.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <GitCommit className="h-4 w-4" />
                Commits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.gitCommitCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.patternCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="activities">
            Activities
            {filterByRuleId && (
              <span className="ml-1 text-xs text-primary">(filtered)</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules">Matching Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <ProjectActivitiesTab
            project={project}
            onCreateRule={handleCreateRuleFromActivities}
            filterByRuleId={filterByRuleId}
            onClearFilter={() => setFilterByRuleId(null)}
            onGoToRule={handleGoToRule}
          />
        </TabsContent>

        <TabsContent value="rules" className="space-y-3">
          {/* Rules Header */}
          <div className="flex justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Rules define patterns to automatically assign activities to this project.
            </p>

            {hasRuleSelection ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedRuleIds.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkApply}
                  disabled={isApplyingBulk}
                >
                  {isApplyingBulk ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-1" />
                  )}
                  Apply to Existing
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={clearRuleSelection}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {patterns && patterns.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={selectAllRules}>
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Select All
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingRule(null);
                    setPrefillPatternType('');
                    setPrefillPatternValue('');
                    setRuleDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rule
                </Button>
              </div>
            )}
          </div>

          {/* Scrollable Rules List */}
          <div className="border rounded-lg h-[400px] overflow-y-auto">
            {patterns && patterns.length > 0 ? (
              <div className="divide-y">
                {patterns.map((pattern) => {
                  const isSelected = selectedRuleIds.has(pattern.id);
                  const isHighlighted = highlightedRuleId === pattern.id;
                  return (
                    <div
                      key={pattern.id}
                      ref={(el) => {
                        if (el) ruleRefs.current.set(pattern.id, el);
                        else ruleRefs.current.delete(pattern.id);
                      }}
                      className={`p-3 flex items-center gap-3 hover:bg-muted/50 cursor-pointer transition-all ${
                        isSelected ? 'bg-primary/5' : ''
                      } ${isHighlighted ? 'bg-primary/10' : ''}`}
                      onClick={() => toggleRuleSelect(pattern.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRuleSelect(pattern.id)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {PATTERN_TYPE_LABELS[pattern.patternType] || pattern.patternType}
                          </Badge>
                          <span className="text-muted-foreground">
                            {MATCH_TYPE_LABELS[pattern.matchType] || pattern.matchType}
                          </span>
                          <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
                            {pattern.patternValue}
                          </code>
                        </div>
                        {pattern.hitCount > 0 && (
                          <button
                            className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewRuleMatches(pattern.id);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            {pattern.hitCount} matches
                          </button>
                        )}
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApplyPattern(pattern.id)}
                          disabled={applyToHistory.isPending}
                          title="Apply to existing events"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingRule({
                              id: pattern.id,
                              projectId: id,
                              patternType: pattern.patternType,
                              patternValue: pattern.patternValue,
                              matchType: pattern.matchType,
                              weight: pattern.weight,
                            });
                            setPrefillPatternType('');
                            setPrefillPatternValue('');
                            setRuleDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeletePattern(pattern.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                <Sparkles className="h-8 w-8 mb-3 opacity-50" />
                <p>No matching rules yet.</p>
                <p className="text-sm mt-1">
                  Add rules to automatically assign activities to this project.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Project Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project.name}"? This will remove all learned
              patterns and clear project assignments from events. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Rules Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedRuleIds.size} Rules</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedRuleIds.size} rules? Events already assigned
              will keep their assignment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground"
              disabled={isDeletingBulk}
            >
              {isDeletingBulk ? 'Deleting...' : `Delete ${selectedRuleIds.size} Rules`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rule Dialog */}
      <ProjectRuleDialog
        open={ruleDialogOpen}
        onOpenChange={(open) => {
          setRuleDialogOpen(open);
          if (!open) {
            setPrefillPatternType('');
            setPrefillPatternValue('');
          }
        }}
        editRule={editingRule}
        defaultProjectId={id}
        defaultPatternType={prefillPatternType || undefined}
        defaultPatternValue={prefillPatternValue || undefined}
      />
    </div>
  );
}
