import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { Clock, CheckSquare, Sparkles, Plus, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useProjectActivities, useBulkAssignProject, useProjects, useProjectPatterns } from '@/api/hooks';
import type { Project, ProjectPattern } from '@/api/client';

interface ProjectActivitiesTabProps {
  project: Project;
  onCreateRule?: (patternType: string, patternValue: string) => void;
  filterByRuleId?: number | null;
  onClearFilter?: () => void;
  onGoToRule?: (ruleId: number) => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Check if an activity matches a pattern
function matchesPattern(activity: { appName: string; windowTitle: string }, pattern: ProjectPattern): boolean {
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

export function ProjectActivitiesTab({
  project,
  onCreateRule,
  filterByRuleId,
  onClearFilter,
  onGoToRule,
}: ProjectActivitiesTabProps) {
  const [dateRange, setDateRange] = useState('7'); // days
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string>('');

  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');

  const { data: activities, isLoading } = useProjectActivities(project.id, startDate, endDate);
  const { data: allProjects } = useProjects();
  const { data: patterns } = useProjectPatterns(project.id);
  const bulkAssign = useBulkAssignProject();

  // Find which pattern matched each activity
  const activityPatternMap = useMemo(() => {
    if (!activities || !patterns) return new Map<string, ProjectPattern>();
    const map = new Map<string, ProjectPattern>();

    for (const activity of activities) {
      const key = `${activity.eventType}-${activity.eventId}`;
      for (const pattern of patterns) {
        if (matchesPattern(activity, pattern)) {
          map.set(key, pattern);
          break; // Use first matching pattern
        }
      }
    }
    return map;
  }, [activities, patterns]);

  // Get the filter pattern if filtering by rule
  const filterPattern = useMemo(() => {
    if (!filterByRuleId || !patterns) return null;
    return patterns.find((p) => p.id === filterByRuleId) || null;
  }, [filterByRuleId, patterns]);

  // Filter activities when filterByRuleId is set
  const displayedActivities = useMemo(() => {
    if (!activities) return [];
    if (!filterByRuleId || !filterPattern) return activities;

    return activities.filter((activity) => {
      const key = `${activity.eventType}-${activity.eventId}`;
      const matchedPattern = activityPatternMap.get(key);
      return matchedPattern?.id === filterByRuleId;
    });
  }, [activities, filterByRuleId, filterPattern, activityPatternMap]);

  const toggleSelect = (key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!displayedActivities.length) return;
    setSelectedIds(new Set(displayedActivities.map((a) => `${a.eventType}-${a.eventId}`)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkReassign = async () => {
    if (!targetProjectId) return;

    const assignments = Array.from(selectedIds).map((key) => {
      const [eventType, eventIdStr] = key.split('-');
      return {
        eventType,
        eventId: parseInt(eventIdStr, 10),
        projectId: parseInt(targetProjectId, 10),
      };
    });

    await bulkAssign.mutateAsync(assignments);
    clearSelection();
    setReassignDialogOpen(false);
    setTargetProjectId('');
  };

  // Get common patterns from selected activities for rule creation suggestions
  const selectedActivities = useMemo(() => {
    if (!displayedActivities.length) return [];
    return displayedActivities.filter((a) => selectedIds.has(`${a.eventType}-${a.eventId}`));
  }, [displayedActivities, selectedIds]);

  // Find common app name or window title substring
  const suggestedRuleValue = useMemo(() => {
    if (selectedActivities.length === 0) return null;

    // Try to find common app name
    const appNames = new Set(selectedActivities.map(a => a.appName?.toLowerCase()).filter(Boolean));
    if (appNames.size === 1) {
      return { type: 'app_name', value: selectedActivities[0].appName };
    }

    // Try to find common substring in window titles
    const titles = selectedActivities.map(a => a.windowTitle || '').filter(Boolean);
    if (titles.length > 0) {
      // Find longest common substring (simplified - just check if all contain a word)
      const words = titles[0].split(/\s+/).filter(w => w.length >= 4);
      for (const word of words) {
        if (titles.every(t => t.toLowerCase().includes(word.toLowerCase()))) {
          return { type: 'window_title', value: word };
        }
      }
    }

    return null;
  }, [selectedActivities]);

  const hasSelection = selectedIds.size > 0;

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading activities...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Filter banner when filtering by rule */}
      {filterPattern && (
        <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>
              Showing activities matching rule:{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                {filterPattern.patternValue}
              </code>
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClearFilter} className="h-7">
            <X className="h-4 w-4 mr-1" />
            Clear filter
          </Button>
        </div>
      )}

      {/* Header with filters and bulk actions */}
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
            {displayedActivities.length} activities
            {filterPattern && activities && displayedActivities.length !== activities.length && (
              <span className="text-muted-foreground/60"> (of {activities.length})</span>
            )}
          </span>
        </div>

        {hasSelection ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            {onCreateRule && suggestedRuleValue && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCreateRule(suggestedRuleValue.type, suggestedRuleValue.value)}
                title={`Create rule: ${suggestedRuleValue.type} contains "${suggestedRuleValue.value}"`}
              >
                <Plus className="h-4 w-4 mr-1" />
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
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={selectAll} disabled={!displayedActivities.length}>
            <CheckSquare className="h-4 w-4 mr-1" />
            Select All
          </Button>
        )}
      </div>

      {/* Scrollable activity list */}
      <div className="border rounded-lg h-[400px] overflow-y-auto">
        {displayedActivities.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground h-full flex items-center justify-center">
            {filterPattern ? 'No activities match this rule in the selected time range' : 'No activities in this time range'}
          </div>
        ) : (
          <div className="divide-y">
            {displayedActivities.map((activity) => {
              const key = `${activity.eventType}-${activity.eventId}`;
              const isSelected = selectedIds.has(key);
              const matchedPattern = activityPatternMap.get(key);

              return (
                <div
                  key={key}
                  className={`p-3 flex items-center gap-3 hover:bg-muted/50 cursor-pointer ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => toggleSelect(key)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(key)}
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{activity.appName}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {activity.windowTitle}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatDuration(activity.durationSeconds)}
                  </div>

                  {matchedPattern ? (
                    <Badge
                      variant="secondary"
                      className={`text-xs shrink-0 ${onGoToRule ? 'cursor-pointer hover:bg-secondary/80' : ''}`}
                      title={`Matched: ${matchedPattern.patternType} ${matchedPattern.matchType} "${matchedPattern.patternValue}"${onGoToRule ? ' (click to view rule)' : ''}`}
                      onClick={(e) => {
                        if (onGoToRule) {
                          e.stopPropagation();
                          onGoToRule(matchedPattern.id);
                        }
                      }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {matchedPattern.patternValue.slice(0, 12)}
                      {matchedPattern.patternValue.length > 12 ? '...' : ''}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {activity.source}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reassign Dialog */}
      <AlertDialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move Activities</AlertDialogTitle>
            <AlertDialogDescription>
              Move {selectedIds.size} activities to another project or unassign them.
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
                {allProjects
                  ?.filter((p) => p.id !== project.id)
                  .map((p) => (
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
    </div>
  );
}
