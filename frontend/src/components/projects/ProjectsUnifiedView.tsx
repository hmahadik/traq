import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { useQueries } from '@tanstack/react-query';
import {
  Clock,
  Sparkles,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  CheckSquare,
  ArrowRight,
  X,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  useProjects,
  useBulkAssignProject,
  useDeleteProjectPattern,
  useApplyRuleToHistory,
  useUnassignedActivities,
} from '@/api/hooks';
import { api } from '@/api/client';
import { ProjectRuleDialog } from '@/components/settings/sections/ProjectRuleDialog';
import { UNASSIGNED_PROJECT_ID } from './ProjectsSidebar';
import type { Project, ProjectPattern } from '@/api/client';

interface ProjectsUnifiedViewProps {
  selectedProjectIds: Set<number>;
  onNewProject: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
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
  regex: 'regex',
};

// Check if an activity matches a pattern
function matchesPattern(
  activity: { appName: string; windowTitle: string },
  pattern: ProjectPattern
): boolean {
  const field = pattern.patternType === 'app_name' ? activity.appName : activity.windowTitle;
  if (!field) return false;

  const fieldLower = field.toLowerCase();
  const patternLower = pattern.patternValue.toLowerCase();

  switch (pattern.matchType) {
    case 'exact':
      return fieldLower === patternLower;
    case 'contains':
      return fieldLower.includes(patternLower);
    case 'prefix':
      return fieldLower.startsWith(patternLower);
    case 'suffix':
      return fieldLower.endsWith(patternLower);
    case 'regex':
      try {
        return new RegExp(pattern.patternValue, 'i').test(field);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function ProjectsUnifiedView({ selectedProjectIds, onNewProject }: ProjectsUnifiedViewProps) {
  const { data: allProjects } = useProjects();
  const deletePattern = useDeleteProjectPattern();
  const applyToHistory = useApplyRuleToHistory();
  const bulkAssign = useBulkAssignProject();

  // Date range for activities
  const [dateRange, setDateRange] = useState('7');
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');

  // Fetch activities and patterns for each selected project
  const selectedProjectsArray = Array.from(selectedProjectIds).filter(id => id !== UNASSIGNED_PROJECT_ID);
  const includeUnassigned = selectedProjectIds.has(UNASSIGNED_PROJECT_ID);

  // Fetch unassigned activities separately
  const unassignedQuery = useUnassignedActivities(startDate, endDate, includeUnassigned);

  // Use useQueries for variable number of projects (avoids hooks-in-map anti-pattern)
  const activitiesQueries = useQueries({
    queries: selectedProjectsArray.map((id) => ({
      queryKey: ['projects', id, 'activities', startDate, endDate],
      queryFn: () => api.projects.getActivities(id, startDate, endDate),
      enabled: id > 0,
    })),
  });

  const patternsQueries = useQueries({
    queries: selectedProjectsArray.map((id) => ({
      queryKey: ['project', id, 'patterns'],
      queryFn: () => api.projects.getPatterns(id),
      enabled: id > 0,
    })),
  });

  // Combine all activities
  const allActivities = useMemo(() => {
    const activities: Array<{
      eventType: string;
      eventId: number;
      appName: string;
      windowTitle: string;
      durationSeconds: number;
      source: string;
      projectId: number;
    }> = [];

    // Add project activities
    activitiesQueries.forEach((q, idx) => {
      const projectId = selectedProjectsArray[idx];
      if (q.data) {
        q.data.forEach((a) => {
          activities.push({ ...a, projectId });
        });
      }
    });

    // Add unassigned activities
    if (includeUnassigned && unassignedQuery.data) {
      unassignedQuery.data.forEach((a) => {
        activities.push({ ...a, projectId: UNASSIGNED_PROJECT_ID });
      });
    }

    return activities;
  }, [activitiesQueries, selectedProjectsArray, includeUnassigned, unassignedQuery.data]);

  // Combine all patterns with project info
  const allPatterns = useMemo(() => {
    const patterns: Array<ProjectPattern & { project?: Project }> = [];

    patternsQueries.forEach((q, idx) => {
      const projectId = selectedProjectsArray[idx];
      const project = allProjects?.find((p) => p.id === projectId);
      if (q.data) {
        q.data.forEach((p) => {
          patterns.push({ ...p, project });
        });
      }
    });

    return patterns;
  }, [patternsQueries, selectedProjectsArray, allProjects]);

  const isLoading = activitiesQueries.some((q) => q.isLoading) ||
    patternsQueries.some((q) => q.isLoading) ||
    (includeUnassigned && unassignedQuery.isLoading);

  // Activity selection state
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string>('');

  // Rule selection state
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Rule dialog state
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<{
    id: number;
    projectId: number;
    patternType: string;
    patternValue: string;
    matchType: string;
    weight: number;
  } | null>(null);
  const [prefillPatternType, setPrefillPatternType] = useState<string>('');
  const [prefillPatternValue, setPrefillPatternValue] = useState<string>('');
  const [prefillProjectId, setPrefillProjectId] = useState<number | undefined>();

  // Suggested rule from selected activities
  const selectedActivities = useMemo(() => {
    return allActivities.filter((a) => selectedActivityIds.has(`${a.eventType}-${a.eventId}`));
  }, [allActivities, selectedActivityIds]);

  const suggestedRule = useMemo(() => {
    if (selectedActivities.length < 2) return null;

    // Check if all from same project
    const projectIds = new Set(selectedActivities.map((a) => a.projectId));
    if (projectIds.size !== 1) return null;
    const projectId = selectedActivities[0].projectId;

    // Try to find common app name
    const appNames = new Set(selectedActivities.map((a) => a.appName?.toLowerCase()).filter(Boolean));
    if (appNames.size === 1) {
      return { projectId, type: 'app_name', value: selectedActivities[0].appName };
    }

    // Try to find common substring in window titles
    const titles = selectedActivities.map((a) => a.windowTitle || '').filter(Boolean);
    if (titles.length > 0) {
      const words = titles[0].split(/\s+/).filter((w) => w.length >= 3);
      for (const word of words) {
        if (titles.every((t) => t.toLowerCase().includes(word.toLowerCase()))) {
          return { projectId, type: 'window_title', value: word };
        }
      }
    }

    return null;
  }, [selectedActivities]);

  // Activity handlers
  const toggleActivitySelect = (key: string) => {
    setSelectedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllActivities = () => {
    setSelectedActivityIds(new Set(allActivities.map((a) => `${a.eventType}-${a.eventId}`)));
  };

  const clearActivitySelection = () => {
    setSelectedActivityIds(new Set());
  };

  const handleBulkReassign = async () => {
    if (!targetProjectId) return;

    const assignments = Array.from(selectedActivityIds).map((key) => {
      const [eventType, eventIdStr] = key.split('-');
      return {
        eventType,
        eventId: parseInt(eventIdStr, 10),
        projectId: parseInt(targetProjectId, 10),
      };
    });

    await bulkAssign.mutateAsync(assignments);
    clearActivitySelection();
    setReassignDialogOpen(false);
    setTargetProjectId('');
  };

  const handleCreateRuleFromSelection = () => {
    if (!suggestedRule) return;
    setEditingRule(null);
    setPrefillProjectId(suggestedRule.projectId);
    setPrefillPatternType(suggestedRule.type);
    setPrefillPatternValue(suggestedRule.value);
    setRuleDialogOpen(true);
  };

  // Rule handlers
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
    setSelectedRuleIds(new Set(allPatterns.map((p) => p.id)));
  };

  const clearRuleSelection = () => {
    setSelectedRuleIds(new Set());
  };

  const handleBulkApplyRules = async () => {
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

  const handleBulkDeleteRules = async () => {
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

  const handleDeletePattern = (patternId: number) => {
    if (confirm('Delete this rule? Events already assigned will keep their assignment.')) {
      deletePattern.mutate(patternId);
    }
  };

  // Empty state
  if (selectedProjectIds.size === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-3">
          <Sparkles className="h-12 w-12 mx-auto opacity-30" />
          <p>Select one or more projects from the sidebar</p>
          <p className="text-sm">or</p>
          <Button onClick={onNewProject}>
            <Plus className="h-4 w-4 mr-2" />
            Create your first project
          </Button>
        </div>
      </div>
    );
  }

  const hasActivitySelection = selectedActivityIds.size > 0;
  const hasRuleSelection = selectedRuleIds.size > 0;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold">
          {selectedProjectsArray.length === 1 && !includeUnassigned
            ? allProjects?.find((p) => p.id === selectedProjectsArray[0])?.name || 'Project'
            : selectedProjectsArray.length === 0 && includeUnassigned
              ? 'Unassigned Activities'
              : `${selectedProjectsArray.length + (includeUnassigned ? 1 : 0)} Selected`}
        </h1>
        {(selectedProjectsArray.length > 1 || (selectedProjectsArray.length >= 1 && includeUnassigned)) && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {includeUnassigned && (
              <Badge variant="outline" className="gap-1.5 border-amber-500 text-amber-600">
                Unassigned
              </Badge>
            )}
            {selectedProjectsArray.map((id) => {
              const project = allProjects?.find((p) => p.id === id);
              if (!project) return null;
              return (
                <Badge key={id} variant="secondary" className="gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  {project.name}
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <Tabs defaultValue="rules" className="flex-1 flex flex-col min-h-0 [&>div[role=tabpanel]]:flex-1 [&>div[role=tabpanel]]:min-h-0">
        <TabsList className="shrink-0 w-fit">
          <TabsTrigger value="rules">
            Rules ({allPatterns.length})
          </TabsTrigger>
          <TabsTrigger value="activities">
            Activities ({allActivities.length})
          </TabsTrigger>
        </TabsList>

        {/* RULES TAB */}
        <TabsContent value="rules" className="flex-1 flex flex-col gap-3 min-h-0 mt-2 data-[state=inactive]:hidden">
          <div className="flex justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Rules automatically assign activities to projects based on patterns.
            </p>

            {hasRuleSelection ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedRuleIds.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkApplyRules}
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
                {allPatterns.length > 0 && (
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
                    setPrefillProjectId(selectedProjectsArray[0]);
                    setRuleDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rule
                </Button>
              </div>
            )}
          </div>

          {/* Rules Table */}
          <div className="border rounded-lg flex-1 min-h-0 flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : allPatterns.length > 0 ? (
              <>
                {/* Column headers */}
                <div className="flex items-center border-b bg-muted/50 text-xs font-medium text-muted-foreground shrink-0">
                  <div className="w-8 px-2 py-2 flex items-center justify-center">
                    <Checkbox
                      checked={selectedRuleIds.size === allPatterns.length && allPatterns.length > 0}
                      onCheckedChange={() => {
                        if (selectedRuleIds.size === allPatterns.length) {
                          clearRuleSelection();
                        } else {
                          selectAllRules();
                        }
                      }}
                      className="h-3.5 w-3.5"
                    />
                  </div>
                  <div className="w-28 px-2 py-2">Project</div>
                  <div className="w-24 px-2 py-2">Field</div>
                  <div className="w-20 px-2 py-2">Match</div>
                  <div className="flex-1 px-2 py-2">Pattern</div>
                  <div className="w-14 px-2 py-2 text-right">Hits</div>
                  <div className="w-24 px-2 py-2"></div>
                </div>

                {/* Rules list */}
                <div className="flex-1 overflow-y-auto text-xs">
                  {allPatterns.map((pattern) => {
                    const isSelected = selectedRuleIds.has(pattern.id);
                    return (
                      <div
                        key={pattern.id}
                        onClick={() => toggleRuleSelect(pattern.id)}
                        className={cn(
                          'flex items-center border-b cursor-pointer select-none group border-l-2',
                          isSelected
                            ? 'bg-primary/10 border-l-primary'
                            : 'border-l-transparent hover:bg-muted/50'
                        )}
                      >
                        <div className="w-8 px-2 py-2 flex items-center justify-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRuleSelect(pattern.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-3.5 w-3.5"
                          />
                        </div>
                        <div className="w-28 px-2 py-2 flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: pattern.project?.color }}
                          />
                          <span className="truncate">{pattern.project?.name}</span>
                        </div>
                        <div className="w-24 px-2 py-2 text-muted-foreground">
                          {PATTERN_TYPE_LABELS[pattern.patternType] || pattern.patternType}
                        </div>
                        <div className="w-20 px-2 py-2 text-muted-foreground">
                          {MATCH_TYPE_LABELS[pattern.matchType] || pattern.matchType}
                        </div>
                        <div className="flex-1 px-2 py-2">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">
                            {pattern.patternValue}
                          </code>
                        </div>
                        <div className="w-14 px-2 py-2 text-right text-muted-foreground">
                          {pattern.hitCount}
                        </div>
                        <div className="w-24 px-2 py-2 flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => applyToHistory.mutate(pattern.id)}
                            disabled={applyToHistory.isPending}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Apply to existing"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingRule({
                                id: pattern.id,
                                projectId: pattern.projectId,
                                patternType: pattern.patternType,
                                patternValue: pattern.patternValue,
                                matchType: pattern.matchType,
                                weight: pattern.weight,
                              });
                              setPrefillPatternType('');
                              setPrefillPatternValue('');
                              setRuleDialogOpen(true);
                            }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit rule"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePattern(pattern.id)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                            title="Delete rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <Sparkles className="h-8 w-8 mb-3 opacity-50" />
                <p>No rules yet.</p>
                <p className="text-sm mt-1">
                  Add rules to automatically assign activities to projects.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ACTIVITIES TAB */}
        <TabsContent value="activities" className="flex-1 flex flex-col gap-3 min-h-0 mt-2 data-[state=inactive]:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Today</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {allActivities.length} activities
              </span>
            </div>

            {hasActivitySelection ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedActivityIds.size} selected
                </span>
                {suggestedRule && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateRuleFromSelection}
                    className="gap-1"
                  >
                    <Lightbulb className="h-4 w-4" />
                    Create Rule
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReassignDialogOpen(true)}
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Move
                </Button>
                <Button variant="ghost" size="sm" onClick={clearActivitySelection}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllActivities}
                disabled={allActivities.length === 0}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Select All
              </Button>
            )}
          </div>

          {/* Activities List */}
          <div className="border rounded-lg flex-1 min-h-0 flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : allActivities.length > 0 ? (
              <>
                {/* Column headers */}
                <div className="flex items-center border-b bg-muted/50 text-xs font-medium text-muted-foreground shrink-0">
                  <div className="w-8 px-2 py-2 flex items-center justify-center">
                    <Checkbox
                      checked={selectedActivityIds.size === allActivities.length && allActivities.length > 0}
                      onCheckedChange={() => {
                        if (selectedActivityIds.size === allActivities.length) {
                          clearActivitySelection();
                        } else {
                          selectAllActivities();
                        }
                      }}
                      className="h-3.5 w-3.5"
                    />
                  </div>
                  {selectedProjectIds.size > 1 && <div className="w-8 px-1 py-2"></div>}
                  <div className="w-24 px-2 py-2">App</div>
                  <div className="flex-1 px-2 py-2">Window Title</div>
                  <div className="w-16 px-2 py-2 text-right">Duration</div>
                  <div className="w-20 px-2 py-2 text-center">Source</div>
                </div>

                {/* Activities list */}
                <div className="flex-1 overflow-y-auto text-xs">
                  {allActivities.map((activity) => {
                    const key = `${activity.eventType}-${activity.eventId}`;
                    const isSelected = selectedActivityIds.has(key);
                    const project = allProjects?.find((p) => p.id === activity.projectId);

                    return (
                      <div
                        key={key}
                        onClick={() => toggleActivitySelect(key)}
                        className={cn(
                          'flex items-center border-b cursor-pointer select-none border-l-2',
                          isSelected
                            ? 'bg-primary/10 border-l-primary'
                            : 'border-l-transparent hover:bg-muted/50'
                        )}
                      >
                        <div className="w-8 px-2 py-2 flex items-center justify-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleActivitySelect(key)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-3.5 w-3.5"
                          />
                        </div>

                        {selectedProjectIds.size > 1 && (
                          <div className="w-8 px-1 py-2 flex items-center justify-center">
                            {activity.projectId === UNASSIGNED_PROJECT_ID ? (
                              <span
                                className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 bg-transparent"
                                title="Unassigned"
                              />
                            ) : project ? (
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: project.color }}
                                title={project.name}
                              />
                            ) : null}
                          </div>
                        )}

                        <div className="w-24 px-2 py-2 truncate font-medium">
                          {activity.appName}
                        </div>
                        <div className="flex-1 px-2 py-2 truncate text-muted-foreground">
                          {activity.windowTitle}
                        </div>
                        <div className="w-16 px-2 py-2 text-right text-muted-foreground">
                          {formatDuration(activity.durationSeconds)}
                        </div>
                        <div className="w-20 px-2 py-2 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">
                            {activity.source}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                No activities in this time range
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Reassign Dialog */}
      <AlertDialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move Activities</AlertDialogTitle>
            <AlertDialogDescription>
              Move {selectedActivityIds.size} activities to another project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={targetProjectId} onValueChange={setTargetProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target project..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {allProjects?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkReassign}
              disabled={!targetProjectId || bulkAssign.isPending}
            >
              {bulkAssign.isPending ? 'Moving...' : 'Move Activities'}
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
              Are you sure? Events already assigned will keep their assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteRules}
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
            setPrefillProjectId(undefined);
          }
        }}
        editRule={editingRule}
        defaultProjectId={prefillProjectId}
        defaultPatternType={prefillPatternType || undefined}
        defaultPatternValue={prefillPatternValue || undefined}
      />
    </div>
  );
}
