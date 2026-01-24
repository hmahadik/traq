import { useState, useMemo, useCallback, useRef } from 'react';
import { format, subDays } from 'date-fns';
import { useQueries } from '@tanstack/react-query';
import {
  Sparkles,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  ArrowRight,
  X,
  Lightbulb,
  Filter,
  FilterX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ResizableHandle } from '@/components/ui/resizable';
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
  app_name: 'App',
  window_title: 'Title',
  git_repo: 'Git',
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
  pattern: { patternType: string; patternValue: string; matchType: string }
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
  const startDate = dateRange === 'all'
    ? '2000-01-01'
    : format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');

  // Selected rule for filtering
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);

  // Resizable panel width (percentage)
  const [rulesWidth, setRulesWidth] = useState(45);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePanelResize = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const deltaPercent = (delta / containerWidth) * 100;
    setRulesWidth((prev) => {
      const newWidth = prev + deltaPercent;
      // Clamp between 25% and 70%
      return Math.max(25, Math.min(70, newWidth));
    });
  }, []);

  // Fetch activities and patterns for each selected project
  const selectedProjectsArray = Array.from(selectedProjectIds).filter(id => id !== UNASSIGNED_PROJECT_ID);
  const includeUnassigned = selectedProjectIds.has(UNASSIGNED_PROJECT_ID);

  // Fetch unassigned activities separately
  const unassignedQuery = useUnassignedActivities(startDate, endDate, includeUnassigned);

  // Use useQueries for variable number of projects
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

    activitiesQueries.forEach((q, idx) => {
      const projectId = selectedProjectsArray[idx];
      if (q.data) {
        q.data.forEach((a) => {
          activities.push({ ...a, projectId });
        });
      }
    });

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

  // Get selected rule
  const selectedRule = useMemo(() => {
    return selectedRuleId ? allPatterns.find(p => p.id === selectedRuleId) : null;
  }, [selectedRuleId, allPatterns]);

  // Filter activities based on selected rule
  const filteredActivities = useMemo(() => {
    if (!selectedRule) return allActivities;
    return allActivities.filter(activity => matchesPattern(activity, selectedRule));
  }, [allActivities, selectedRule]);

  const isLoading = activitiesQueries.some((q) => q.isLoading) ||
    patternsQueries.some((q) => q.isLoading) ||
    (includeUnassigned && unassignedQuery.isLoading);

  // Activity selection state
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string>('');

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

  // Bulk delete dialog
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<number>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Suggested rule from selected activities
  const selectedActivities = useMemo(() => {
    return filteredActivities.filter((a) => selectedActivityIds.has(`${a.eventType}-${a.eventId}`));
  }, [filteredActivities, selectedActivityIds]);

  const suggestedRule = useMemo(() => {
    if (selectedActivities.length < 2) return null;

    const projectIds = new Set(selectedActivities.map((a) => a.projectId));
    if (projectIds.size !== 1) return null;
    const projectId = selectedActivities[0].projectId;

    const appNames = new Set(selectedActivities.map((a) => a.appName?.toLowerCase()).filter(Boolean));
    if (appNames.size === 1) {
      return { projectId, type: 'app_name', value: selectedActivities[0].appName };
    }

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

  // Handlers
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
    setSelectedActivityIds(new Set(filteredActivities.map((a) => `${a.eventType}-${a.eventId}`)));
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

  const handleDeletePattern = (patternId: number) => {
    if (confirm('Delete this rule? Events already assigned will keep their assignment.')) {
      deletePattern.mutate(patternId);
      if (selectedRuleId === patternId) {
        setSelectedRuleId(null);
      }
    }
  };

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

  const handleBulkDeleteRules = async () => {
    setIsDeletingBulk(true);
    try {
      for (const ruleId of selectedRuleIds) {
        await deletePattern.mutateAsync(ruleId);
      }
      setSelectedRuleIds(new Set());
      setBulkDeleteDialogOpen(false);
      if (selectedRuleId && selectedRuleIds.has(selectedRuleId)) {
        setSelectedRuleId(null);
      }
    } finally {
      setIsDeletingBulk(false);
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
    <div className="h-full flex flex-col gap-3">
      {/* Side by side panels */}
      <div ref={containerRef} className="flex-1 min-h-0 flex gap-3">
        {/* Rules Panel */}
        <div style={{ width: `${rulesWidth}%`, flexShrink: 0 }} className="h-full overflow-hidden border rounded-lg">
          <div className="h-full flex flex-col">
            {/* Rules header */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <span className="text-sm font-medium">Rules ({allPatterns.length})</span>
              <div className="flex items-center gap-1">
                {hasRuleSelection && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => setBulkDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete ({selectedRuleIds.size})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setSelectedRuleIds(new Set())}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setEditingRule(null);
                    setPrefillPatternType('');
                    setPrefillPatternValue('');
                    setPrefillProjectId(selectedProjectsArray[0]);
                    setRuleDialogOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {/* Rules list */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : allPatterns.length > 0 ? (
                <div className="text-xs">
                  {allPatterns.map((pattern) => {
                    const isSelected = selectedRuleId === pattern.id;
                    const isChecked = selectedRuleIds.has(pattern.id);
                    return (
                      <div
                        key={pattern.id}
                        onClick={() => setSelectedRuleId(isSelected ? null : pattern.id)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 border-b cursor-pointer group border-l-2',
                          isSelected
                            ? 'bg-primary/10 border-l-primary'
                            : 'border-l-transparent hover:bg-muted/50'
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleRuleSelect(pattern.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: pattern.project?.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">
                              {PATTERN_TYPE_LABELS[pattern.patternType]}
                            </span>
                            <span className="text-muted-foreground/60">
                              {MATCH_TYPE_LABELS[pattern.matchType]}
                            </span>
                            <code className="bg-muted px-1 rounded font-mono truncate text-[11px]">
                              {pattern.patternValue}
                            </code>
                          </div>
                        </div>
                        <span className="text-muted-foreground tabular-nums">{pattern.hitCount}</span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => applyToHistory.mutate(pattern.id)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Apply to existing"
                          >
                            <Sparkles className="h-3 w-3" />
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
                              setRuleDialogOpen(true);
                            }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDeletePattern(pattern.id)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
                  <p>No rules yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <ResizableHandle onResize={handlePanelResize} />

        {/* Activities Panel */}
        <div className="flex-1 min-w-0 h-full overflow-hidden border rounded-lg">
          <div className="h-full flex flex-col">
            {/* Activities header */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  Activities ({filteredActivities.length})
                </span>
                {selectedRule && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Filter className="h-3 w-3" />
                    Filtered by rule
                    <button
                      onClick={() => setSelectedRuleId(null)}
                      className="hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Today</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
                {hasActivitySelection ? (
                  <>
                    {suggestedRule && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={handleCreateRuleFromSelection}
                      >
                        <Lightbulb className="h-3 w-3 mr-1" />
                        Create Rule
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setReassignDialogOpen(true)}
                    >
                      <ArrowRight className="h-3 w-3 mr-1" />
                      Move ({selectedActivityIds.size})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1 text-xs"
                      onClick={clearActivitySelection}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={selectAllActivities}
                    disabled={filteredActivities.length === 0}
                  >
                    Select All
                  </Button>
                )}
              </div>
            </div>

            {/* Column headers */}
            <div className="shrink-0 flex items-center border-b bg-muted/50 text-xs font-medium text-muted-foreground">
              <div className="w-8 px-2 py-1.5 flex items-center justify-center">
                <Checkbox
                  checked={selectedActivityIds.size === filteredActivities.length && filteredActivities.length > 0}
                  onCheckedChange={() => {
                    if (selectedActivityIds.size === filteredActivities.length) {
                      clearActivitySelection();
                    } else {
                      selectAllActivities();
                    }
                  }}
                  className="h-3 w-3"
                />
              </div>
              {selectedProjectIds.size > 1 && <div className="w-6"></div>}
              <div className="w-20 px-1 py-1.5">App</div>
              <div className="flex-1 px-1 py-1.5">Window Title</div>
              <div className="w-14 px-1 py-1.5 text-right">Dur</div>
            </div>

            {/* Activities list */}
            <div className="flex-1 overflow-y-auto text-xs">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredActivities.length > 0 ? (
                filteredActivities.map((activity) => {
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
                      <div className="w-8 px-2 py-1.5 flex items-center justify-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleActivitySelect(key)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3 w-3"
                        />
                      </div>

                      {selectedProjectIds.size > 1 && (
                        <div className="w-6 flex items-center justify-center">
                          {activity.projectId === UNASSIGNED_PROJECT_ID ? (
                            <span className="w-2 h-2 rounded-full border border-amber-500" />
                          ) : project ? (
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: project.color }}
                            />
                          ) : null}
                        </div>
                      )}

                      <div className="w-20 px-1 py-1.5 truncate font-medium">
                        {activity.appName}
                      </div>
                      <div className="flex-1 px-1 py-1.5 truncate text-muted-foreground">
                        {activity.windowTitle}
                      </div>
                      <div className="w-14 px-1 py-1.5 text-right text-muted-foreground tabular-nums">
                        {formatDuration(activity.durationSeconds)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  {selectedRule ? 'No activities match this rule' : 'No activities in this time range'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
