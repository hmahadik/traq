import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  useProjects,
  useCreateProjectRule,
  useUpdateProjectRule,
  useApplyRuleToHistory,
  usePreviewRuleMatches,
} from '@/api/hooks';
import { useDebounce } from '@/hooks/useDebounce';

// Pattern type options
const PATTERN_TYPES = [
  { value: 'window_title', label: 'Window Title' },
  { value: 'app_name', label: 'App Name' },
  { value: 'git_repo', label: 'Git Repo' },
  { value: 'domain', label: 'Domain' },
];

// Match type options
const MATCH_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact Match' },
  { value: 'prefix', label: 'Starts With' },
  { value: 'suffix', label: 'Ends With' },
  { value: 'regex', label: 'Regex' },
];

interface ExistingRule {
  id: number;
  projectId: number;
  patternType: string;
  patternValue: string;
  matchType: string;
  weight: number;
}

interface ProjectRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editRule?: ExistingRule | null; // If provided, we're editing an existing rule
  defaultProjectId?: number;
  defaultPatternType?: string;
  defaultPatternValue?: string;
}

export function ProjectRuleDialog({
  open,
  onOpenChange,
  editRule,
  defaultProjectId,
  defaultPatternType,
  defaultPatternValue,
}: ProjectRuleDialogProps) {
  const { data: projects } = useProjects();
  const createRule = useCreateProjectRule();
  const updateRule = useUpdateProjectRule();
  const applyToHistory = useApplyRuleToHistory();

  // Form state
  const [projectId, setProjectId] = useState<number | null>(editRule?.projectId || defaultProjectId || null);
  const [patternType, setPatternType] = useState(editRule?.patternType || 'window_title');
  const [patternValue, setPatternValue] = useState(editRule?.patternValue || '');
  const [matchType, setMatchType] = useState(editRule?.matchType || 'contains');
  const [applyToExisting, setApplyToExisting] = useState(true);

  // Debounce the pattern value for preview
  const debouncedValue = useDebounce(patternValue, 500);

  // Build preview query
  const previewQuery = useMemo(() => {
    if (!debouncedValue || debouncedValue.length < 2) return null;
    return {
      patternType,
      patternValue: debouncedValue,
      matchType,
    };
  }, [debouncedValue, patternType, matchType]);

  // Fetch preview data
  const { data: preview, isLoading: previewLoading, error: previewError } = usePreviewRuleMatches(previewQuery);

  // Reset form when dialog opens or editRule changes
  useEffect(() => {
    if (open) {
      if (editRule) {
        setProjectId(editRule.projectId);
        setPatternType(editRule.patternType);
        setPatternValue(editRule.patternValue);
        setMatchType(editRule.matchType);
        setApplyToExisting(false); // Default to false for edits
      } else {
        setProjectId(defaultProjectId || null);
        setPatternType(defaultPatternType || 'window_title');
        setPatternValue(defaultPatternValue || '');
        setMatchType('contains');
        setApplyToExisting(true);
      }
    }
  }, [open, editRule, defaultProjectId, defaultPatternType, defaultPatternValue]);

  const handleSave = async () => {
    if (!projectId || !patternValue.trim()) return;

    try {
      if (editRule) {
        // Update existing rule
        await updateRule.mutateAsync({
          id: editRule.id,
          rule: {
            patternType,
            patternValue: patternValue.trim(),
            matchType,
          },
        });

        // Optionally apply to history
        if (applyToExisting) {
          await applyToHistory.mutateAsync(editRule.id);
        }
      } else {
        // Create new rule
        const newRule = await createRule.mutateAsync({
          projectId,
          patternType,
          patternValue: patternValue.trim(),
          matchType,
        });

        // Optionally apply to history
        if (applyToExisting && newRule?.id) {
          await applyToHistory.mutateAsync(newRule.id);
        }
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  };

  const isValid = projectId && patternValue.trim().length >= 2;
  const isSaving = createRule.isPending || updateRule.isPending || applyToHistory.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full overflow-hidden">
        <DialogHeader>
          <DialogTitle>{editRule ? 'Edit Rule' : 'Add Matching Rule'}</DialogTitle>
          <DialogDescription>
            Define a pattern to automatically assign activities to a project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 min-w-0 overflow-hidden">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select
              value={projectId?.toString() || ''}
              onValueChange={(val) => setProjectId(parseInt(val, 10))}
              disabled={!!editRule} // Can't change project when editing
            >
              <SelectTrigger id="project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pattern Type */}
          <div className="space-y-2">
            <Label htmlFor="patternType">Match Field</Label>
            <Select value={patternType} onValueChange={setPatternType}>
              <SelectTrigger id="patternType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PATTERN_TYPES.map((pt) => (
                  <SelectItem key={pt.value} value={pt.value}>
                    {pt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Match Type */}
          <div className="space-y-2">
            <Label htmlFor="matchType">Match Type</Label>
            <Select value={matchType} onValueChange={setMatchType}>
              <SelectTrigger id="matchType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_TYPES.map((mt) => (
                  <SelectItem key={mt.value} value={mt.value}>
                    {mt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pattern Value */}
          <div className="space-y-2">
            <Label htmlFor="patternValue">Pattern</Label>
            <Input
              id="patternValue"
              value={patternValue}
              onChange={(e) => setPatternValue(e.target.value)}
              placeholder={matchType === 'regex' ? '^traq.*$' : 'traq'}
            />
            {matchType === 'regex' && (
              <p className="text-xs text-muted-foreground">
                Uses Go/RE2 regular expression syntax
              </p>
            )}
          </div>

          {/* Live Preview */}
          {patternValue.length >= 2 && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-2 overflow-hidden">
              <div className="font-medium flex items-center gap-2">
                Preview
                {previewLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>

              {previewError ? (
                <div className="text-red-500 text-xs break-words">
                  {previewError instanceof Error ? previewError.message : 'Invalid pattern'}
                </div>
              ) : preview ? (
                <>
                  <div>
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {preview.matchCount}
                    </span>{' '}
                    matching events
                  </div>
                  {preview.sampleMatches && preview.sampleMatches.length > 0 && (
                    <div className="space-y-1 min-w-0">
                      <div className="text-muted-foreground text-xs">Sample matches:</div>
                      <ul className="text-xs space-y-0.5 max-h-24 overflow-y-auto overflow-x-hidden">
                        {preview.sampleMatches.map((sample, i) => (
                          <li key={i} className="truncate min-w-0" title={sample}>
                            {sample}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground">
                  Type at least 2 characters to preview
                </div>
              )}
            </div>
          )}

          {/* Apply to Existing */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="applyToExisting"
              checked={applyToExisting}
              onCheckedChange={(checked) => setApplyToExisting(checked === true)}
            />
            <Label htmlFor="applyToExisting" className="text-sm font-normal cursor-pointer">
              Apply to existing events
              {preview && preview.matchCount > 0 && applyToExisting && (
                <span className="text-muted-foreground ml-1">
                  ({preview.matchCount} will be assigned)
                </span>
              )}
            </Label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editRule ? 'Save Changes' : 'Create Rule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
